// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/scene_perception/win/scene_perception_object.h"

#include "base/bind.h"
#include "base/files/file.h"
#include "base/files/file_path.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/logging.h"

namespace {
using namespace realsense::jsapi::scene_perception; // NOLINT
using JSThresholds = realsense::jsapi::scene_perception::MeshingThresholds;

bool isPercentage(float value) {
  return (value >= 0 && value <= 1);
}

bool isValidThresholds(JSThresholds* thresholds) {
  return (isPercentage(thresholds->max) && isPercentage(thresholds->avg));
}

bool isValidFramerate(int fr) {
  return (fr == 30 || fr == 60);
}

bool copyImageRGB32(PXCImage* color, uint8_t* uint8_array) {
  if (!(color && uint8_array)) {
    DLOG(ERROR) << "Null image or buffer.";
    return false;
  }
  PXCImage::ImageData color_data;
  PXCImage::ImageInfo info = color->QueryInfo();
  pxcStatus status = color->AcquireAccess(
      PXCImage::ACCESS_READ, PXCImage::PIXEL_FORMAT_RGB32, &color_data);
  if (status != PXC_STATUS_NO_ERROR) {
    DLOG(ERROR) << "Failed to access color image.";
    return false;
  }
  int k = 0;
  for (int y = 0; y < info.height; ++y) {
    for (int x = 0; x < info.width; ++x) {
      uint8_t* rgb32 = reinterpret_cast<uint8_t*>(color_data.planes[0]);
      int i = (x + info.width * y) * 4;
      uint8_array[k++] = rgb32[i + 2];
      uint8_array[k++] = rgb32[i + 1];
      uint8_array[k++] = rgb32[i];
      uint8_array[k++] = rgb32[i + 3];
    }
  }
  color->ReleaseAccess(&color_data);
  return true;
}

Accuracy toJsAccuracy(PXCScenePerception::TrackingAccuracy accuracy) {
  Accuracy result = ACCURACY_NONE;
  switch (accuracy) {
    case PXCScenePerception::HIGH:
      result = ACCURACY_HIGH;
      break;
    case PXCScenePerception::MED:
      result = ACCURACY_MED;
      break;
    case PXCScenePerception::LOW:
      result = ACCURACY_LOW;
      break;
    case PXCScenePerception::FAILED:
      result = ACCURACY_FAILED;
      break;
  }
  return result;
}
}  // namespace

namespace realsense {
namespace scene_perception {

using namespace realsense::jsapi::scene_perception; // NOLINT
using namespace xwalk::common; // NOLINT

// Default configurations.
// Volume preview size is currently fixed to this resolution.
const int kCaptureWidth = 320;
const int kCaptureHeight = 240;
const float kCaptureFramerate = 60.0;

const PXCSession::CoordinateSystem kCoordinateSystem =
        PXCSession::COORDINATE_SYSTEM_REAR_OPENCV;

// Default values of SP module:
//   MaxNumberOfBlockMeshes: 16384
//   MaxNumberOfFaces: 2621440
//   MaxNumberOfVertices: 7864320
// Temporarily set MaxNumberOfBlockMeshes to 1000 for acceptable performance in
// scene perception sample.
const int kMaxNumberOfBlockMeshes = 1000;
const int kMaxNumberOfFaces = 2621440;
const int kMaxNumberOfVertices = 7864320;
const bool kBUseColor = true;

ScenePerceptionObject::ScenePerceptionObject() :
    state_(IDLE),
    checking_event_on_(false),
    meshupdated_event_on_(false),
    sampleprocessed_event_on_(false),
    doing_meshing_updating_(false),
    sensemanager_thread_("SceneManagerThread"),
    meshing_thread_("MeshingThread"),
    message_loop_(base::MessageLoopProxy::current()),
    session_(NULL),
    sense_manager_(NULL),
    scene_perception_(NULL),
    block_meshing_data_(NULL),
    surface_voxels_data_(NULL),
    latest_color_image_(NULL),
    latest_depth_image_(NULL) {
  last_meshing_time_ = base::TimeTicks::Now();

  // Size and framte rate for depth and color images.
  color_image_width_ = depth_image_width_ = kCaptureWidth;
  color_image_height_ = depth_image_height_ = kCaptureHeight;
  color_capture_framerate_ = depth_capture_framerate_ = kCaptureFramerate;

  // Configurations for meshing data.
  max_block_mesh_ = kMaxNumberOfBlockMeshes;
  max_faces_ = kMaxNumberOfFaces;
  max_vertices_ = kMaxNumberOfVertices;
  b_use_color_ = kBUseColor;

  // Default meshing update info configurations.
  meshing_update_info_.countOfBlockMeshesRequired = true;
  meshing_update_info_.blockMeshesRequired = true;
  meshing_update_info_.countOfVeticesRequired = true;
  meshing_update_info_.verticesRequired = true;
  meshing_update_info_.countOfFacesRequired = true;
  meshing_update_info_.facesRequired = true;
  meshing_update_info_.colorsRequired = true;
  b_fill_holes_ = false;

  // State changing triggers.
  handler_.Register("init",
                    base::Bind(&ScenePerceptionObject::OnInit,
                               base::Unretained(this)));
  handler_.Register("start",
                    base::Bind(&ScenePerceptionObject::OnStart,
                               base::Unretained(this)));
  handler_.Register("stop",
                    base::Bind(&ScenePerceptionObject::OnStop,
                               base::Unretained(this)));
  handler_.Register("reset",
                    base::Bind(&ScenePerceptionObject::OnReset,
                               base::Unretained(this)));
  handler_.Register("destory",
                    base::Bind(&ScenePerceptionObject::OnDestory,
                               base::Unretained(this)));

  // Configuration changing APIs.
  handler_.Register("enableReconstruction",
                    base::Bind(&ScenePerceptionObject::OnEnableReconstruction,
                               base::Unretained(this)));
  handler_.Register("enableRelocalization",
                    base::Bind(&ScenePerceptionObject::OnEnableRelocalization,
                               base::Unretained(this)));
  handler_.Register("setMeshingResolution",
                    base::Bind(&ScenePerceptionObject::OnSetMeshingResolution,
                               base::Unretained(this)));
  handler_.Register("setMeshingThresholds",
                    base::Bind(&ScenePerceptionObject::OnSetMeshingThresholds,
                               base::Unretained(this)));
  handler_.Register("setCameraPose",
                    base::Bind(&ScenePerceptionObject::OnSetCameraPose,
                               base::Unretained(this)));
  handler_.Register("setMeshingUpdateConfigs",
                    base::Bind(
                      &ScenePerceptionObject::OnSetMeshingUpdateConfigs,
                      base::Unretained(this)));
  handler_.Register("configureSurfaceVoxelsData",
                    base::Bind(
                      &ScenePerceptionObject::OnConfigureSurfaceVoxelsData,
                      base::Unretained(this)));
  handler_.Register("setMeshingRegion",
                    base::Bind(&ScenePerceptionObject::OnSetMeshingRegion,
                               base::Unretained(this)));

  // Data and configurations getting APIs.
  handler_.Register("getSample",
                    base::Bind(&ScenePerceptionObject::OnGetSample,
                               base::Unretained(this)));
  handler_.Register("getVolumePreview",
                    base::Bind(&ScenePerceptionObject::OnGetVolumePreview,
                               base::Unretained(this)));
  handler_.Register("getVertices",
                    base::Bind(&ScenePerceptionObject::OnGetVertices,
                               base::Unretained(this)));
  handler_.Register("getNormals",
                    base::Bind(&ScenePerceptionObject::OnGetNormals,
                               base::Unretained(this)));
  handler_.Register("isReconstructionEnabled",
                    base::Bind(
                      &ScenePerceptionObject::OnIsReconstructionEnabled,
                      base::Unretained(this)));
  handler_.Register("getVoxelResolution",
                    base::Bind(&ScenePerceptionObject::OnGetVoxelResolution,
                               base::Unretained(this)));
  handler_.Register("getVoxelSize",
                    base::Bind(&ScenePerceptionObject::OnGetVoxelSize,
                               base::Unretained(this)));
  handler_.Register("getMeshingThresholds",
                    base::Bind(&ScenePerceptionObject::OnGetMeshingThresholds,
                               base::Unretained(this)));
  handler_.Register("getMeshingResolution",
                    base::Bind(&ScenePerceptionObject::OnGetMeshingResolution,
                               base::Unretained(this)));
  handler_.Register("getMeshData",
                    base::Bind(&ScenePerceptionObject::OnGetMeshData,
                               base::Unretained(this)));

  handler_.Register("getSurfaceVoxels",
                    base::Bind(&ScenePerceptionObject::OnGetSurfaceVoxels,
                               base::Unretained(this)));

  handler_.Register("saveMesh",
                    base::Bind(&ScenePerceptionObject::OnSaveMesh,
                               base::Unretained(this)));
  handler_.Register("clearMeshingRegion",
                    base::Bind(&ScenePerceptionObject::OnClearMeshingRegion,
                               base::Unretained(this)));
}

ScenePerceptionObject::~ScenePerceptionObject() {
  if (state_ != IDLE) {
    OnDestory(NULL);
  }

  sample_message_.reset();
  volume_preview_message_.reset();
  vertices_normals_message_.reset();
  meshing_data_message_.reset();
  latest_vertices_.reset();
  latest_normals_.reset();
}

void ScenePerceptionObject::ReleaseResources() {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());
  if (latest_color_image_) {
    latest_color_image_->Release();
    latest_color_image_ = NULL;
  }
  if (latest_depth_image_) {
    latest_depth_image_->Release();
    latest_depth_image_ = NULL;
  }
  if (block_meshing_data_) {
    block_meshing_data_->Release();
    block_meshing_data_ = NULL;
  }

  if (surface_voxels_data_) {
    surface_voxels_data_->Release();
    surface_voxels_data_ = NULL;
  }

  if (sense_manager_) {
    sense_manager_->Close();
    sense_manager_->Release();
    sense_manager_ = NULL;
  }

  if (session_) {
    session_->Release();
    session_ = NULL;
  }
}

void ScenePerceptionObject::StopSceneManagerThread() {
  message_loop_->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnStopSceneManagerThread,
                 base::Unretained(this)));
}

void ScenePerceptionObject::OnStopSceneManagerThread() {
  if (sensemanager_thread_.IsRunning()) {
    sensemanager_thread_.Stop();
  }
}

void ScenePerceptionObject::StartEvent(const std::string& type) {
  if (type == std::string("checking")) {
    checking_event_on_ = true;
  } else if (type == std::string("meshupdated")) {
    meshupdated_event_on_ = true;
  } else if (type == std::string("sampleprocessed")) {
    sampleprocessed_event_on_ = true;
  }
}

void ScenePerceptionObject::StopEvent(const std::string& type) {
  if (type == std::string("checking")) {
    checking_event_on_ = false;
  } else if (type == std::string("meshupdated")) {
    meshupdated_event_on_ = false;
  } else if (type == std::string("sampleprocessed")) {
    sampleprocessed_event_on_ = false;
  }
}

void ScenePerceptionObject::triggerError(const std::string msg) {
    ErrorEvent event;
    event.status = msg;

    scoped_ptr<base::ListValue> eventData(new base::ListValue);
    eventData->Append(event.ToValue().release());

    DispatchEvent("error", eventData.Pass());
}

/** ---------------- Implementation for state triggers --------------**/
void ScenePerceptionObject::OnInit(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (sensemanager_thread_.IsRunning()) {
    info->PostResult(
        Init::Results::Create(
            std::string(), std::string("scenemanager thread is running")));
    return;  // Wrong state.
  }
  sensemanager_thread_.Start();

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnCreateAndStartPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnCreateAndStartPipeline(
      scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ != IDLE) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(), std::string("state is not IDLE")));
    StopSceneManagerThread();
    return;
  }

  session_ = PXCSession::CreateInstance();
  if (!session_) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(), std::string("failed to create session")));
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }
  sense_manager_ = session_->CreateSenseManager();
  if (!sense_manager_) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(), std::string("failed to create sense manager")));
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  scoped_ptr<Init::Params> params(Init::Params::Create(*info->arguments()));
  if (!params || !(params->config)) {
    // Set the coordinate system as OPENCV.
    session_->SetCoordinateSystem(kCoordinateSystem);
  } else {
    // Set the module according to the parameters.
    applyInitialConfigs(params->config.get());
  }

  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_COLOR,
                               color_image_width_, color_image_height_,
                               color_capture_framerate_);
  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_DEPTH,
                               depth_image_width_, depth_image_height_,
                               depth_capture_framerate_);

  pxcStatus status = sense_manager_->EnableScenePerception();
  if (status != PXC_STATUS_NO_ERROR) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(),
            std::string("failed to enable scene perception module")));
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  scene_perception_ = sense_manager_->QueryScenePerception();
  if (scene_perception_ == NULL) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(),
            std::string("failed to create scene perception")));
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  sense_manager_->PauseScenePerception(true);
  scene_perception_->EnableSceneReconstruction(true);

  /** Init the pipeline **/
  status = sense_manager_->Init();
  if (status != PXC_STATUS_NO_ERROR) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Init::Results::Create(
            std::string(), std::string("failed to init pipeline")));
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }
  scene_perception_->GetInternalCameraIntrinsics(&sp_intrinsics_);

  state_ = INITIALIZED;

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnRunPipeline,
        base::Unretained(this)));

  info->PostResult(
        Init::Results::Create(
            std::string("success"), std::string()));
}

void ScenePerceptionObject::applyInitialConfigs(
    InitialConfiguration* jsConfig) {
  if (jsConfig->use_open_cv_coordinate_system) {
    bool useOPENCV = *(jsConfig->use_open_cv_coordinate_system.get());
    PXCSession::CoordinateSystem c = useOPENCV ? kCoordinateSystem
      : PXCSession::COORDINATE_SYSTEM_REAR_DEFAULT;
    session_->SetCoordinateSystem(c);
  }
  if (jsConfig->voxel_resolution) {
    switch (jsConfig->voxel_resolution) {
      case VOXEL_RESOLUTION_LOW:
        scene_perception_->SetVoxelResolution(
          PXCScenePerception::VoxelResolution::LOW_RESOLUTION);
        break;
      case VOXEL_RESOLUTION_MED:
        scene_perception_->SetVoxelResolution(
          PXCScenePerception::VoxelResolution::MED_RESOLUTION);
        break;
      case VOXEL_RESOLUTION_HIGH:
        scene_perception_->SetVoxelResolution(
          PXCScenePerception::VoxelResolution::HIGH_RESOLUTION);
        break;
      default:
        triggerError("Invalid parameter [voxelResolution].");
    }
  }
  if (jsConfig->initial_camera_pose) {
    // TODO(Donna): check SetInitialCameraPose is valid before 'Init'.
    float pose[12];
    std::vector<double> jsPose = *(jsConfig->initial_camera_pose.get());
    for (int i = 0; i < 12; i++) {
      pose[i] = static_cast<float>(jsPose[i]);
    }
    if (PXC_STATUS_NO_ERROR != scene_perception_->SetInitialPose(pose)) {
      triggerError("Failed to apply parameter [initialCameraPose].");
    }
  }
  if (jsConfig->meshing_thresholds) {
    MeshingThresholds* jsThresholds = jsConfig->meshing_thresholds.get();

    if (isValidThresholds(jsThresholds)) {
      // TODO(Donna): check SetMeshingThresholds is valid before 'Init'.
      if (PXC_STATUS_NO_ERROR != scene_perception_->SetMeshingThresholds(
            jsThresholds->max, jsThresholds->avg)) {
        triggerError("Failed to apply [meshingThresholds].");
      }
    } else {
      triggerError("Invalid parameter [meshingThresholds].");
    }
  }
  if (jsConfig->color_capture_size) {
    color_image_width_ = jsConfig->color_capture_size->width;
    color_image_height_ = jsConfig->color_capture_size->height;
  }
  if (jsConfig->depth_capture_size) {
    CaptureSize* ds = jsConfig->depth_capture_size.get();
    depth_image_width_ = ds->width;
    depth_image_height_ = ds->height;
  }
  if (jsConfig->capture_framerate) {
    int framerate = *(jsConfig->capture_framerate.get());
    if (isValidFramerate(framerate))
      color_capture_framerate_ = depth_capture_framerate_ = framerate;
    else
      triggerError("Unsupported [captureFramerate].");
  }
}

void ScenePerceptionObject::OnRunPipeline() {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE)
    return;

  pxcStatus status = sense_manager_->AcquireFrame(true);
  if (status < PXC_STATUS_NO_ERROR) {
    triggerError("Failed to process next frame.");

    ReleaseResources();
    state_ = IDLE;
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QueryScenePerceptionSample();
  if (!sample) {
    // If the SP module is paused, the sample will be NULL.
    // Query the raw color/depth images to support live preview and
    // calculation of scene quality
    sample = sense_manager_->QuerySample();
  }

  if (!sample || !sample->color || !sample->depth) {
    triggerError("Failed to query sample.");

    ReleaseResources();
    state_ = IDLE;
    return;
  }

  // Keep color and depth images.
  // Allocate memory for images if necessary.
  if (!latest_color_image_) {
    PXCImage::ImageInfo image_info;
    memset(&image_info, 0, sizeof(image_info));
    image_info.width = color_image_width_;
    image_info.height = color_image_height_;
    image_info.format = PXCImage::PIXEL_FORMAT_RGB32;
    latest_color_image_ = session_->CreateImage(&image_info);
  }

  if (!latest_depth_image_) {
    PXCImage::ImageInfo image_info;
    memset(&image_info, 0, sizeof(image_info));
    image_info.width = depth_image_width_;
    image_info.height = depth_image_height_;
    image_info.format = PXCImage::PIXEL_FORMAT_DEPTH;
    latest_depth_image_ = session_->CreateImage(&image_info);
  }

  // Copy the images.
  latest_color_image_->CopyImage(sample->color);
  latest_depth_image_->CopyImage(sample->depth);

  // Get the depth quality.
  float quality = 0.0;
  quality = scene_perception_->CheckSceneQuality(sample);

  if ((state_ == INITIALIZED) && checking_event_on_) {
    CheckingEvent event;
    event.quality = quality;
    scoped_ptr<base::ListValue> eventData(new base::ListValue);
    eventData->Append(event.ToValue().release());

    DispatchEvent("checking", eventData.Pass());
  }

  if (state_ == STARTED) {
    PXCScenePerception::TrackingAccuracy accuracy;
    accuracy = scene_perception_->QueryTrackingAccuracy();
    float pose[12];
    scene_perception_->GetCameraPose(pose);

    if (sampleprocessed_event_on_) {
      SampleProcessedEvent event;
      event.quality = quality;
      event.accuracy = toJsAccuracy(accuracy);
      for (int i = 0; i < 12; ++i) {
        event.camera_pose.push_back(pose[i]);
      }
      scoped_ptr<base::ListValue> eventData(new base::ListValue);
      eventData->Append(event.ToValue().release());

      DispatchEvent("sampleprocessed", eventData.Pass());
    }

    if (meshupdated_event_on_
        && !doing_meshing_updating_
        && scene_perception_->IsReconstructionUpdated()) {
      DispatchEvent("meshupdated");
    }

    // Keep vertices from current camera pose.
    // PXCPoint3DF32 * internalWidth * internalHeight.
    // PXCPoint3DF32 = [float x, float y, float z]
    if (!latest_vertices_) {
      latest_vertices_.reset(new uint8[3 * sizeof(float) *
          sp_intrinsics_.imageSize.width * sp_intrinsics_.imageSize.height]);
    }
    scene_perception_->GetVertices(
        reinterpret_cast<PXCPoint3DF32*>(latest_vertices_.get()));

    // Keep normals from current camera pose.
    if (!latest_normals_) {
      latest_normals_.reset(new uint8[3 * sizeof(float) *
          sp_intrinsics_.imageSize.width * sp_intrinsics_.imageSize.height]);
    }
    scene_perception_->GetNormals(
        reinterpret_cast<PXCPoint3DF32*>(latest_normals_.get()));
  }

  sense_manager_->ReleaseFrame();

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnRunPipeline,
                 base::Unretained(this)));
}

void ScenePerceptionObject::OnDestory(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(
        Destory::Results::Create(
            std::string(), std::string("scenemanager thread is not running")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnStopAndDestroyPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
  sensemanager_thread_.Stop();
}

void ScenePerceptionObject::OnStopAndDestroyPipeline(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    info->PostResult(
        Destory::Results::Create(
            std::string(), std::string("state is IDLE")));
    return;
  }
  state_ = IDLE;
  ReleaseResources();
  if (info.get()) {
    info->PostResult(
        Destory::Results::Create(
            std::string("success"), std::string()));
  }
}

void ScenePerceptionObject::OnReset(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(Reset::Results::Create(
        std::string(), std::string("scenemanager thread is not running")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnResetScenePerception,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnResetScenePerception(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE) {
    info->PostResult(
        Reset::Results::Create(
            std::string(), std::string("state is IDLE")));
    return;
  }
  scene_perception_->Reset();

  if (block_meshing_data_)  block_meshing_data_->Reset();

  if (surface_voxels_data_)  surface_voxels_data_->Reset();
}

void ScenePerceptionObject::DoPauseScenePerception(
    bool pause, scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  // Start the SP module, enable tracking.
  if (!pause) {
    if (state_ != INITIALIZED) {
      info->PostResult(
          Start::Results::Create(
              std::string(), std::string("state is not INITIALIZED")));
      return;
    }
    state_ = STARTED;
    sense_manager_->PauseScenePerception(pause);
    info->PostResult(
        Start::Results::Create(
          std::string("success"), std::string()));
  } else {
    if (state_ != STARTED) {
      info->PostResult(
          Stop::Results::Create(
              std::string(), std::string("state is not STARTED")));
      return;
    }
    state_ = INITIALIZED;
    sense_manager_->PauseScenePerception(pause);
    info->PostResult(
        Stop::Results::Create(
          std::string("success"), std::string()));
  }
}

void ScenePerceptionObject::OnStart(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(Start::Results::Create(
        std::string(), std::string("scenemanager thread is not running")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoPauseScenePerception,
                 base::Unretained(this),
                 false,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnStop(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(Stop::Results::Create(
        std::string(), std::string("scenemanager thread is not running")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoPauseScenePerception,
                 base::Unretained(this),
                 true,
                 base::Passed(&info)));
}

/**
 * Native behave:
 * IsReconstructionUpdated is associated with Meshing.
 * If you had pulled all the updates using DoMeshingUpdate
 * prior to disabling Reconstruction then it will return false.
 * Otherwise it will keep on retuning true unless you pull
 * all the meshing data.
 */
void ScenePerceptionObject::DoEnableReconstruction(
    bool enable, scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (PXC_STATUS_NO_ERROR !=
      scene_perception_->EnableSceneReconstruction(enable)) {
    info->PostResult(EnableReconstruction::Results::Create(
          std::string(), std::string("Failed to set SP resonctruction.")));
  } else {
    // Stop meshing thread if all data pulled out and the reconstruction
    // is set to false.
    if (!enable && !scene_perception_->IsReconstructionUpdated()
        && meshing_thread_.IsRunning()) {
      meshing_thread_.Stop();
    }
    info->PostResult(
        EnableReconstruction::Results::Create(
          std::string("success"), std::string()));
  }
}

void ScenePerceptionObject::OnEnableReconstruction(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<EnableReconstruction::Params> params(
      EnableReconstruction::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        EnableReconstruction::Results::Create(
          std::string(), "Malformed parameters for enableReconstruction"));
    return;
  }
  if (state_ == IDLE || !sensemanager_thread_.IsRunning()) {
    info->PostResult(EnableReconstruction::Results::Create(
        std::string(), std::string("Wrong state to set SP reconstruction.")));
    return;  // Wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoEnableReconstruction,
                 base::Unretained(this),
                 params->enable,
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoEnableRelocalization(
    bool enable, scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (PXC_STATUS_NO_ERROR !=
      scene_perception_->EnableRelocalization(enable)) {
    info->PostResult(EnableRelocalization::Results::Create(
          std::string(), std::string("Failed to enable SP relocalization.")));
  } else {
    info->PostResult(
        EnableRelocalization::Results::Create(
          std::string("success"), std::string()));
  }
}

void ScenePerceptionObject::OnEnableRelocalization(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<EnableRelocalization::Params> params(
      EnableRelocalization::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        EnableRelocalization::Results::Create(
          std::string(), "Malformed parameters for enableRelocalization"));
    return;
  }
  if (state_ == IDLE || !sensemanager_thread_.IsRunning()) {
    info->PostResult(EnableRelocalization::Results::Create(
        std::string(),
        std::string("Wrong state to enable SP Relocalization.")));
    return;  // Wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoEnableRelocalization,
                 base::Unretained(this),
                 params->enable,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnGetVertices(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    VerticesOrNormals data;
    info->PostResult(GetVertices::Results::Create(
        data, std::string("Wrong state, or pipeline is not started.")));
    return;
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoCopyVertices,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoCopyVertices(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (!latest_vertices_) {
    VerticesOrNormals data;
    info->PostResult(GetVertices::Results::Create(
        data, std::string("No available vertices or in wrong state.")));
    return;
  }

  DoCopyVerticesOrNormals(latest_vertices_.Pass());

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(vertices_normals_message_.get()),
        vertices_normals_message_size_));
  info->PostResult(result.Pass());
}

void ScenePerceptionObject::DoCopyVerticesOrNormals(scoped_ptr<uint8[]> data) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  // Format of vertices or normals:
  // Call id(int),
  // width(int), height(int),
  // data buffer (PXCPoint3DF32 buffer)
  //     [float x, float y, float z] * width * height
  size_t headLength = 3 * sizeof(int);
  size_t width = sp_intrinsics_.imageSize.width;
  size_t height = sp_intrinsics_.imageSize.height;
  size_t dataLength = 3 * sizeof(float) * width * height;
  if (!vertices_normals_message_) {
    vertices_normals_message_size_ = headLength + dataLength;
    vertices_normals_message_.reset(
        new uint8[vertices_normals_message_size_]);
  }
  int* int_array = reinterpret_cast<int*>(vertices_normals_message_.get());
  int_array[1] = sp_intrinsics_.imageSize.width;
  int_array[2] = sp_intrinsics_.imageSize.height;
  char* data_offset =
      reinterpret_cast<char*>(vertices_normals_message_.get()) + headLength;
  memcpy(data_offset, reinterpret_cast<char*>(data.get()), dataLength);
}

void ScenePerceptionObject::OnGetNormals(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    VerticesOrNormals data;
    info->PostResult(GetNormals::Results::Create(
        data, std::string("Wrong state, or pipeline is not started.")));
    return;
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoCopyNormals,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoCopyNormals(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (!latest_normals_) {
    VerticesOrNormals data;
    info->PostResult(GetVertices::Results::Create(
        data, std::string("No available vertices or in wrong state.")));
    return;
  }

  DoCopyVerticesOrNormals(latest_normals_.Pass());

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(vertices_normals_message_.get()),
        vertices_normals_message_size_));
  info->PostResult(result.Pass());
}

void ScenePerceptionObject::OnGetMeshData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    MeshData data;
    info->PostResult(GetMeshData::Results::Create(
        data, std::string("Wrong state, or pipeline is not started.")));
    return;
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoGetMeshData,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoGetMeshData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());
  if (!block_meshing_data_) {
    // initialize the meshing_data buffer
    block_meshing_data_ = scene_perception_->CreatePXCBlockMeshingData(
        max_block_mesh_, max_vertices_, max_faces_, b_use_color_);
  }
  if (doing_meshing_updating_
      || !(scene_perception_->IsReconstructionUpdated())
      || !(base::TimeTicks::Now() - last_meshing_time_ >
        base::TimeDelta::FromMilliseconds(1000))) {
    MeshData data;
    info->PostResult(GetMeshData::Results::Create(
        data, std::string("Meshing thread is busy or no new mesh data.")));
  } else {
    doing_meshing_updating_ = true;
    DLOG(INFO) << "Request meshing";
    // Start the meshing thread if needed.
    if (!meshing_thread_.IsRunning()) {
      meshing_thread_.Start();
    }
    meshing_thread_.message_loop()->PostTask(
        FROM_HERE,
        base::Bind(&ScenePerceptionObject::DoMeshingUpdateOnMeshingThread,
                   base::Unretained(this),
                   base::Passed(&info)));
  }
}

void ScenePerceptionObject::DoMeshingUpdateOnMeshingThread(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(meshing_thread_.message_loop(), base::MessageLoop::current());
  pxcStatus status = scene_perception_->DoMeshingUpdate(block_meshing_data_,
                                                        0,
                                                        &meshing_update_info_);
  // Failed to get mesh updates.
  if (status != PXC_STATUS_NO_ERROR) {
    sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnMeshingResult,
                 base::Unretained(this)));
  }

  DLOG(INFO) << "Meshing succeeds";

  float* vertices = block_meshing_data_->QueryVertices();
  int num_of_vertices = block_meshing_data_->QueryNumberOfVertices();
  unsigned char* colors = block_meshing_data_->QueryVerticesColor();
  int* faces = block_meshing_data_->QueryFaces();
  int num_of_faces = block_meshing_data_->QueryNumberOfFaces();
  int num_of_blockmeshes = block_meshing_data_->QueryNumberOfBlockMeshes();

  const int header_byte_length = 4 * sizeof(int);
  const int blockmesh_int_length = 5;
  const int blockmesh_byte_length = blockmesh_int_length * sizeof(int);
  const int vertices_byte_length = num_of_vertices * 4 * sizeof(float);
  const int faces_byte_length = num_of_faces * 3 * sizeof(int);
  const int colors_byte_length = num_of_vertices * 3 * sizeof(unsigned char);

  meshing_data_message_size_ =
      header_byte_length
      + num_of_blockmeshes * blockmesh_byte_length
      + vertices_byte_length
      + faces_byte_length
      + colors_byte_length;

  meshing_data_message_.reset(
      new uint8[meshing_data_message_size_]);
  int* int_array = reinterpret_cast<int*>(meshing_data_message_.get());
  int_array[1] = num_of_blockmeshes;
  int_array[2] = num_of_vertices;
  int_array[3] = num_of_faces;

  PXCBlockMeshingData::PXCBlockMesh *block_mesh_data =
      block_meshing_data_->QueryBlockMeshes();
  char* block_meshes_offset =
      reinterpret_cast<char*>(meshing_data_message_.get()) +
      header_byte_length;
  int* block_meshes_array = reinterpret_cast<int*>(block_meshes_offset);
  for (int i = 0; i < num_of_blockmeshes; ++i, ++block_mesh_data) {
    block_meshes_array[i * blockmesh_int_length] = block_mesh_data->meshId;
    block_meshes_array[i * blockmesh_int_length + 1] =
        block_mesh_data->vertexStartIndex;
    block_meshes_array[i * blockmesh_int_length + 2] =
        block_mesh_data->numVertices;
    block_meshes_array[i * blockmesh_int_length + 3] =
        block_mesh_data->faceStartIndex;
    block_meshes_array[i * blockmesh_int_length + 4] =
        block_mesh_data->numFaces;
  }

  char* vertices_offset = block_meshes_offset
      + num_of_blockmeshes * blockmesh_byte_length;
  memcpy(vertices_offset, reinterpret_cast<char*>(vertices),
         vertices_byte_length);

  char* faces_offset = vertices_offset + vertices_byte_length;
  memcpy(faces_offset, reinterpret_cast<char*>(faces), faces_byte_length);

  char* colors_offset = faces_offset + faces_byte_length;
  memcpy(colors_offset, reinterpret_cast<char*>(colors), colors_byte_length);

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(meshing_data_message_.get()),
        meshing_data_message_size_));
  info->PostResult(result.Pass());

  // Notice the scenemanager thread that mesh data updating done.
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnMeshingResult,
                 base::Unretained(this)));
}

void ScenePerceptionObject::OnMeshingResult() {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  last_meshing_time_ = base::TimeTicks::Now();
  doing_meshing_updating_ = false;
}

/** ---------------- Implementation for setters --------------**/
void ScenePerceptionObject::DoSetMeshingResolution(
    PXCScenePerception::MeshResolution resolution,
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (PXC_STATUS_NO_ERROR ==
      scene_perception_->SetMeshingResolution(resolution)) {
    info->PostResult(SetMeshingResolution::Results::Create(
          std::string("Success"), std::string()));
  } else {
    info->PostResult(SetMeshingResolution::Results::Create(
          std::string(), "Failed to set meshing resolution."));
  }
}
void ScenePerceptionObject::OnSetMeshingResolution(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<SetMeshingResolution::Params> params(
      SetMeshingResolution::Params::Create(*info->arguments()));

  if (!params || !(params->m_resolution)) {
    info->PostResult(SetMeshingResolution::Results::Create(
          std::string(),
          "Malformed parameters for setMeshingResolution"));
    return;
  }
  PXCScenePerception::MeshResolution resolution;
  switch (params->m_resolution) {
    case MESHING_RESOLUTION_LOW:
      resolution = PXCScenePerception::MeshResolution::LOW_RESOLUTION_MESH;
      break;
    case MESHING_RESOLUTION_MED:
      resolution = PXCScenePerception::MeshResolution::MED_RESOLUTION_MESH;
      break;
    case MESHING_RESOLUTION_HIGH:
      resolution = PXCScenePerception::MeshResolution::HIGH_RESOLUTION_MESH;
      break;
    default:
      info->PostResult(SetMeshingResolution::Results::Create(
            std::string(), "Invalid parameters for setMeshingResolution"));
      return;
  }
  if (state_ == IDLE || !sensemanager_thread_.IsRunning()) {
    info->PostResult(SetMeshingResolution::Results::Create(
        std::string(), std::string("Wrong state to set meshing resolution.")));
    return;
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoSetMeshingResolution,
                 base::Unretained(this),
                 resolution,
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoSetMeshingThresholds(
    float max, float avg,
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  if (PXC_STATUS_NO_ERROR ==
      scene_perception_->SetMeshingThresholds(max, avg)) {
    info->PostResult(SetMeshingThresholds::Results::Create(
          std::string("Success"), std::string()));
  } else {
    info->PostResult(SetMeshingThresholds::Results::Create(
          std::string(), "Failed to set meshing thresholds."));
  }
}
void ScenePerceptionObject::OnSetMeshingThresholds(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  // Get params from info.
  scoped_ptr<SetMeshingThresholds::Params> params(
      SetMeshingThresholds::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetMeshingThresholds::Results::Create(
          std::string(),
          "Malformed parameters for setMeshingThresholds"));
    return;
  }
  MeshingThresholds* jsThresholds = &(params->m_thresholds);
  if (!isValidThresholds(jsThresholds)) {
    info->PostResult(SetMeshingThresholds::Results::Create(
          std::string(),
          std::string("Invalid parameter for meshing thresholds")));
    return;
  }

  // Check the state.
  if (state_ == IDLE || !sensemanager_thread_.IsRunning()) {
    info->PostResult(SetMeshingThresholds::Results::Create(
        std::string(),
        std::string("Wrong state to set meshing thresholds.")));
    return;
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoSetMeshingThresholds,
                 base::Unretained(this),
                 jsThresholds->max, jsThresholds->avg,
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoSetCameraPose(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  scoped_ptr<SetCameraPose::Params> params(
      SetCameraPose::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetCameraPose::Results::Create(
          std::string(), "Malformed parameters for setCameraPose"));
    return;
  }

  float pose[12];
  for (int i = 0; i < 12; i++) {
    pose[i] = static_cast<float>((params->pose)[i]);
  }

  if (PXC_STATUS_NO_ERROR ==
      scene_perception_->SetCameraPose(pose)) {
    info->PostResult(SetCameraPose::Results::Create(
          std::string("Success"), std::string()));
  } else {
    info->PostResult(SetCameraPose::Results::Create(
          std::string(), "Failed to set camera pose."));
  }
}

void ScenePerceptionObject::OnSetCameraPose(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {

  if (state_ != STARTED || !sensemanager_thread_.IsRunning()) {
    info->PostResult(SetCameraPose::Results::Create(
          std::string(),
          std::string("Wrong state to set camera pose.")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoSetCameraPose,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnSetMeshingUpdateConfigs(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<SetMeshingUpdateConfigs::Params> params(
         SetMeshingUpdateConfigs::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetMeshingUpdateConfigs::Results::Create(
          std::string(),
          std::string("Malformed parameters for setMeshingUpdateConfigs.")));
  }

  b_fill_holes_ = *(params->config.b_fill_holes.get());

  if (params->config.update_info) {
    MeshingUpdateInfo* jsUpdateInfo = params->config.update_info.get();

    meshing_update_info_.countOfBlockMeshesRequired
            = jsUpdateInfo-> count_of_block_meshes_required;
    meshing_update_info_.blockMeshesRequired
            = jsUpdateInfo->block_meshes_required;
    meshing_update_info_.countOfVeticesRequired
            = jsUpdateInfo->count_of_vetices_required;
    meshing_update_info_.verticesRequired = jsUpdateInfo->vertices_required;
    meshing_update_info_.countOfFacesRequired
            = jsUpdateInfo->count_of_faces_required;
    meshing_update_info_.facesRequired = jsUpdateInfo->faces_required;
    meshing_update_info_.colorsRequired = jsUpdateInfo->colors_required;
  }
}

void ScenePerceptionObject::OnConfigureSurfaceVoxelsData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning() || state_ != STARTED) {
    info->PostResult(ConfigureSurfaceVoxelsData::Results::Create(
        std::string(),
        std::string("Wrong state to get configure surfaceVoxlesData.")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoConfigureSurfaceVoxelsData,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoConfigureSurfaceVoxelsData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  scoped_ptr<ConfigureSurfaceVoxelsData::Params> params(
      ConfigureSurfaceVoxelsData::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(ConfigureSurfaceVoxelsData::Results::Create(
        std::string(),
        std::string("Malformed parameters for configureSurfaceVoxelsData.")));
    return;
  }
  // Re-allocate the memory for surface voxels data.
  if (surface_voxels_data_) surface_voxels_data_->Release();

  surface_voxels_data_ =
    scene_perception_->CreatePXCSurfaceVoxelsData(
        params->config.voxel_count, params->config.use_color);
  if (surface_voxels_data_) {
    info->PostResult(ConfigureSurfaceVoxelsData::Results::Create(
        std::string("Success"),
        std::string()));
  } else {
    info->PostResult(ConfigureSurfaceVoxelsData::Results::Create(
        std::string(),
        std::string("Failed to configureSurfaceVoxelsData.")));
  }
}

void ScenePerceptionObject::OnSetMeshingRegion(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  // Operations on meshing region should after initialization.
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(SetMeshingRegion::Results::Create(
          std::string(),
          std::string("Wrong state to setMeshingRegion.")));
    return;
  }
  scoped_ptr<SetMeshingRegion::Params> params(
         SetMeshingRegion::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetMeshingRegion::Results::Create(
          std::string(),
          std::string("Malformed parameters for setMeshingRegion.")));
    return;
  }
  PXCPoint3DF32 lowPoint = PXCPoint3DF32();
  lowPoint.x = params->region.lower_left_front_point.x;
  lowPoint.y = params->region.lower_left_front_point.y;
  lowPoint.z = params->region.lower_left_front_point.z;

  PXCPoint3DF32 upperPoint = PXCPoint3DF32();
  upperPoint.x = params->region.upper_right_rear_point.x;
  upperPoint.y = params->region.upper_right_rear_point.y;
  upperPoint.z = params->region.upper_right_rear_point.z;

  if (scene_perception_->SetMeshingRegion(&lowPoint, &upperPoint)
      < PXC_STATUS_NO_ERROR) {
    info->PostResult(SetMeshingRegion::Results::Create(
          std::string(),
          std::string("Failed to setMeshingRegion.")));
    return;
  }
  info->PostResult(SetMeshingRegion::Results::Create(
        std::string("Succeeded to setMeshingRegion."),
        std::string()));
}

/** ---------------- Implementation for getters --------------**/
void ScenePerceptionObject::OnGetSample(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    Sample sample;
    info->PostResult(GetSample::Results::Create(
        sample, std::string("Wrong state, or pipeline is not started.")));
    return;
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoCopySample,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoCopySample(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());
  if (!(latest_color_image_ && latest_depth_image_)) {
    Sample sample;
    info->PostResult(GetSample::Results::Create(
        sample, std::string("No valiable sample.")));
    return;
  }

  PXCImage* color = latest_color_image_;
  PXCImage* depth = latest_depth_image_;

  PXCImage::ImageInfo color_info = color->QueryInfo();
  PXCImage::ImageInfo depth_info = depth->QueryInfo();

  // sample message: call_id (i32),
  // color_width (i32), color_height (i32),
  // depth_width (i32), depth_height (i32),
  // color (int8 buffer), depth (int16 buffer)
  int cDataOffset = 4 * 5;
  int dDataOffset = cDataOffset + color_info.width * color_info.height * 4;
  if (!sample_message_) {
    sample_message_size_ = dDataOffset
      + depth_info.width * depth_info.height * 2;
    sample_message_.reset(
        new uint8[sample_message_size_]);
  }
  int* int_array = reinterpret_cast<int*>(sample_message_.get());
  int_array[1] = color_info.width;
  int_array[2] = color_info.height;
  int_array[3] = depth_info.width;
  int_array[4] = depth_info.height;

  copyImageRGB32(color,
         reinterpret_cast<uint8_t*>(
         sample_message_.get() + cDataOffset));

  PXCImage::ImageData depth_data;
  pxcStatus status = depth->AcquireAccess(
      PXCImage::ACCESS_READ, PXCImage::PIXEL_FORMAT_DEPTH, &depth_data);
  uint16_t* uint16_array = reinterpret_cast<uint16_t*>(
      sample_message_.get() + dDataOffset);
  if (status >= PXC_STATUS_NO_ERROR) {
    int k = 0;
    for (int y = 0; y < depth_info.height; ++y) {
      for (int x = 0; x < depth_info.width; ++x) {
        uint16_t* depth16 =
          reinterpret_cast<uint16_t*>(
              depth_data.planes[0] + depth_data.pitches[0] * y);
        uint16_array[k++] = depth16[x];
      }
    }
    depth->ReleaseAccess(&depth_data);
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(sample_message_.get()),
        sample_message_size_));
  info->PostResult(result.Pass());
}

void ScenePerceptionObject::DoGetVolumePreview(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  scoped_ptr<GetVolumePreview::Params> params(
      GetVolumePreview::Params::Create(*info->arguments()));
  Image image;

  if (!params) {
    info->PostResult(
        GetVolumePreview::Results::Create(
          image, "Malformed parameters for getVolumePreview"));
    return;
  }
  pxcF32 pose[12];
  for (int i = 0; i < 12; i++) {
    pose[i] = static_cast<float>((params->pose)[i]);
  }

  PXCImage* vPreview = scene_perception_->QueryVolumePreview(pose);
  // sample message: call_id (i32),
  // width (i32), height (i32),
  // RGBA_data (int8 buffer)
  PXCImage::ImageInfo imageInfo = vPreview->QueryInfo();
  int dataOffset = 3 * sizeof(int);
  // Allocate the buffer if needed.
  if (!volume_preview_message_) {
    size_t internalSize =
      sp_intrinsics_.imageSize.width * sp_intrinsics_.imageSize.height;
    volume_preview_message_size_ = dataOffset + internalSize * 4;
    volume_preview_message_.reset(
        new uint8[volume_preview_message_size_]);
  }
  int* int_array = reinterpret_cast<int*>(volume_preview_message_.get());
  int_array[1] = imageInfo.width;
  int_array[2] = imageInfo.height;

  copyImageRGB32(vPreview,
         reinterpret_cast<uint8_t*>(
         volume_preview_message_.get() + dataOffset));

  // Need to release to image.
  vPreview->Release();
  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(volume_preview_message_.get()),
        volume_preview_message_size_));
  info->PostResult(result.Pass());
}

void ScenePerceptionObject::OnGetVolumePreview(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Image image;
  if (!sensemanager_thread_.IsRunning() || state_ != STARTED) {
    info->PostResult(GetVolumePreview::Results::Create(
        image, std::string("Wrong state to get volume preview.")));
    return;  // Wrong state.
  }
  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoGetVolumePreview,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnIsReconstructionEnabled(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!sensemanager_thread_.IsRunning()) {
    // Reconstruction is enabled by default.
    info->PostResult(IsReconstructionEnabled::Results::Create(
          true, std::string("wrong state, start the process first.")));
    return;  // wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoCheckReconstructionFlag,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoCheckReconstructionFlag(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  info->PostResult(IsReconstructionEnabled::Results::Create(
        scene_perception_->IsSceneReconstructionEnabled() != 0,
        std::string()));
}

/*
 * VoxelResolution can not be changed if the pipeline
 * initialized, so just get it in extension thread.
 */
void ScenePerceptionObject::OnGetVoxelResolution(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  VoxelResolution jsResolution = VOXEL_RESOLUTION_NONE;
  if (state_ == IDLE) {
    info->PostResult(GetVoxelResolution::Results::Create(
        jsResolution,
        std::string("Wrong state, start the process first.")));
    return;  // wrong state.
  }
  switch (scene_perception_->QueryVoxelResolution()) {
    case PXCScenePerception::VoxelResolution::LOW_RESOLUTION:
      jsResolution = VOXEL_RESOLUTION_LOW;
      break;
    case PXCScenePerception::VoxelResolution::MED_RESOLUTION:
      jsResolution = VOXEL_RESOLUTION_MED;
      break;
    case PXCScenePerception::VoxelResolution::HIGH_RESOLUTION:
      jsResolution = VOXEL_RESOLUTION_HIGH;
      break;
  }
  info->PostResult(GetVoxelResolution::Results::Create(
        jsResolution, std::string()));
}

/*
 * VoxelSize is related with voxel resolution.
 */
void ScenePerceptionObject::OnGetVoxelSize(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (state_ == IDLE) {
    info->PostResult(GetVoxelSize::Results::Create(
        0,
        std::string("Wrong state, start the process first.")));
    return;  // wrong state.
  }
  info->PostResult(GetVoxelSize::Results::Create(
      scene_perception_->QueryVoxelSize(), std::string()));
}

void ScenePerceptionObject::OnGetMeshingThresholds(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  JSThresholds result;
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(GetMeshingThresholds::Results::Create(
        result,
        std::string("Wrong state, start the process first.")));
    return;  // wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoGetMeshingThresholds,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoGetMeshingThresholds(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  JSThresholds result;
  float max, avg;
  bool status = (
    PXC_STATUS_NO_ERROR == scene_perception_->QueryMeshingThresholds(
      &max, &avg));
  std::string msg = status ? std::string()
                    : "Failed to get thresholds after pipeline.";
  if (status) {
    result.max = static_cast<double>(max);
    result.avg = static_cast<double>(avg);
  }
  info->PostResult(GetMeshingThresholds::Results::Create(result, msg));
}

void ScenePerceptionObject::OnGetMeshingResolution(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  MeshingResolution mr = MESHING_RESOLUTION_NONE;
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(GetMeshingResolution::Results::Create(
        mr,
        std::string("Wrong state, start the process first.")));
    return;  // wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoGetMeshingResolution,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::DoGetMeshingResolution(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  MeshingResolution mr = MESHING_RESOLUTION_NONE;
  switch (scene_perception_->QueryMeshingResolution()) {
    case PXCScenePerception::MeshResolution::LOW_RESOLUTION_MESH:
      mr = MESHING_RESOLUTION_LOW;
      break;
    case PXCScenePerception::MeshResolution::MED_RESOLUTION_MESH:
      mr = MESHING_RESOLUTION_MED;
      break;
    case PXCScenePerception::MeshResolution::HIGH_RESOLUTION_MESH:
      mr = MESHING_RESOLUTION_HIGH;
      break;
  }
  info->PostResult(GetMeshingResolution::Results::Create(
        mr, std::string()));
}

void ScenePerceptionObject::OnGetSurfaceVoxels(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  SurfaceVoxelsData data;
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(GetSurfaceVoxels::Results::Create(
          data,
          std::string("Wrong state to get surface voxels.")));
    return;  // wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoGetSurfaceVoxels,
        base::Unretained(this),
        base::Passed(&info)));
}

void ScenePerceptionObject::DoGetSurfaceVoxels(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  SurfaceVoxelsData data;

  PXCPoint3DF32* lowerLeftFrontPoint = NULL;
  PXCPoint3DF32* upperRightRearPoint = NULL;

  // Allocate the memory if needed.
  if (!surface_voxels_data_) {
    surface_voxels_data_ = scene_perception_->CreatePXCSurfaceVoxelsData();
    if (!surface_voxels_data_) {
      info->PostResult(GetSurfaceVoxels::Results::Create(
            data,
            std::string("Failed to create surface voxels data.")));
      return;
    }
  }

  scoped_ptr<GetSurfaceVoxels::Params> params(
      GetSurfaceVoxels::Params::Create(*info->arguments()));
  if (params && params->region) {
    PXCPoint3DF32 lowPoint = PXCPoint3DF32();
    lowPoint.x = params->region->lower_left_front_point.x;
    lowPoint.y = params->region->lower_left_front_point.y;
    lowPoint.z = params->region->lower_left_front_point.z;
    lowerLeftFrontPoint = &lowPoint;

    PXCPoint3DF32 upperPoint = PXCPoint3DF32();
    upperPoint.x = params->region->upper_right_rear_point.x;
    upperPoint.y = params->region->upper_right_rear_point.y;
    upperPoint.z = params->region->upper_right_rear_point.z;
    upperRightRearPoint = &upperPoint;
  }

  pxcStatus status = scene_perception_->ExportSurfaceVoxels(
                       surface_voxels_data_,
                       lowerLeftFrontPoint,
                       upperRightRearPoint);
  int dataPending = 0;
  if (status == PXC_STATUS_DATA_PENDING) {
    dataPending = 1;
  } else if (status != PXC_STATUS_NO_ERROR) {
    info->PostResult(GetSurfaceVoxels::Results::Create(
          data,
          std::string("Failed to get surface voxels.")));
    return;
  }

  // Put all data in a binary buffer.
  // Format:
  //   CallbackID(int32),
  //   dataPending(int32),
  //   numberOfSurfaceVoxels(int32),
  //   hasColorData(int32, whether the color data is available),
  //   centerOfsurface_voxels_data_(Point3D[])
  //   surfaceVoxelsColorData(unit8[], 3 * BYTE,  RGB for each voxel)
  int numberOfVoxels = surface_voxels_data_->QueryNumberOfSurfaceVoxels();
  float* voxels = reinterpret_cast<float*>(
      surface_voxels_data_->QueryCenterOfSurfaceVoxels());
  if (!voxels) {
    info->PostResult(GetSurfaceVoxels::Results::Create(
          data,
          std::string("No surface voxels data.")));
    return;
  }
  // It will return NULL, if no voxels color data.
  uint8_t* voxelsColor = reinterpret_cast<uint8_t*>(
                         surface_voxels_data_->QuerySurfaceVoxelsColor());
  int hasColorData = voxelsColor ? 1 : 0;

  int voxelsDataOffset = 4 * sizeof(int);
  int colorOffset = voxelsDataOffset + numberOfVoxels * 3 * sizeof(float);
  size_t bMessageSize = colorOffset + numberOfVoxels * 3;
  scoped_ptr<uint8[]> bMessage;
  bMessage.reset(new uint8[bMessageSize]);

  // The first sizeof(int) bytes will be used for callback id.
  int* intBuffer = reinterpret_cast<int*>(bMessage.get() + 1 * sizeof(int));
  intBuffer[0] = dataPending;
  intBuffer[1] = numberOfVoxels;
  intBuffer[2] = hasColorData;

  // Put the voxels data into bMessage.
  float* voxelsData = reinterpret_cast<float*>(
                      bMessage.get() + voxelsDataOffset);
  for (int i = 0; i < numberOfVoxels * 3; i++) {
    voxelsData[i] = voxels[i];
  }

  // Put the voxels color data into bMessage.
  if (hasColorData) {
    uint8_t* rgbColor = reinterpret_cast<uint8_t*>(
                        bMessage.get() + colorOffset);
    for (int i = 0; i < numberOfVoxels * 3; i++) {
      rgbColor[i] = voxelsColor[i];
    }
  }

  // Post binary message to JS side.
  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(bMessage.get()),
        bMessageSize));
  info->PostResult(result.Pass());
}

// Save the Mesh data to an ASCII obj file.
void ScenePerceptionObject::OnSaveMesh(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  std::vector<char> buffer;
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(SaveMesh::Results::Create(
          buffer,
          std::string("Wrong state to save mesh, start the process first.")));
    return;  // wrong state.
  }

  sensemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::DoSaveMesh,
        base::Unretained(this),
        base::Passed(&info)));
}

// Default configurations in the info.
//    fillMeshHoles: false,
//    saveMeshColor: true,
//    MeshResolution: HIGH_RESOLUTION_MESH
void ScenePerceptionObject::DoSaveMesh(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(sensemanager_thread_.message_loop(), base::MessageLoop::current());

  std::vector<char> buffer;
  PXCScenePerception::SaveMeshInfo mInfo;

  mInfo.fillMeshHoles = false;
  mInfo.saveMeshColor = true;
  mInfo.meshResolution =
    PXCScenePerception::MeshResolution::HIGH_RESOLUTION_MESH;

  scoped_ptr<SaveMesh::Params> params(
      SaveMesh::Params::Create(*info->arguments()));
  if (params && params->info) {
    if (params->info->fill_mesh_holes)
      mInfo.fillMeshHoles = *(params->info->fill_mesh_holes.get());
    if (params->info->save_mesh_color)
      mInfo.saveMeshColor = *(params->info->save_mesh_color.get());
    if (params->info->mesh_resolution) {
      MeshingResolution r = params->info->mesh_resolution;
      switch (r) {
        case MESHING_RESOLUTION_LOW:
          mInfo.meshResolution
            = PXCScenePerception::MeshResolution::LOW_RESOLUTION_MESH;
          break;
        case MESHING_RESOLUTION_MED:
          mInfo.meshResolution
            = PXCScenePerception::MeshResolution::MED_RESOLUTION_MESH;
          break;
        case MESHING_RESOLUTION_HIGH:
          mInfo.meshResolution
            = PXCScenePerception::MeshResolution::HIGH_RESOLUTION_MESH;
          break;
      }
    }
  }

  // Create a tmp file to get mesh data.
  base::ScopedTempDir tmp_dir;
  tmp_dir.CreateUniqueTempDir();
  base::FilePath tmp_file = tmp_dir.path().Append(
      FILE_PATH_LITERAL("tmp_mesh.obj"));
  wchar_t* wfile = const_cast<wchar_t*>(tmp_file.value().c_str());
  if (scene_perception_->SaveMeshExtended(wfile, &mInfo)
      < PXC_STATUS_NO_ERROR) {
    info->PostResult(SaveMesh::Results::Create(buffer, "Failed to SaveMesh"));
    return;
  }

  base::File file(tmp_file, base::File::FLAG_OPEN | base::File::FLAG_READ);
  int64 file_length = file.GetLength();
  size_t bMessageSize = file_length + sizeof(int);
  scoped_ptr<uint8[]> bMessage;
  bMessage.reset(new uint8[bMessageSize]);
  // the first sizeof(int) bytes will be used for callback id.
  char* data = reinterpret_cast<char*>(bMessage.get() + 1 * sizeof(int));
  file.Read(0, data, file_length);
  file.Close();

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
        reinterpret_cast<const char*>(bMessage.get()),
        bMessageSize));
  info->PostResult(result.Pass());
}

void ScenePerceptionObject::OnClearMeshingRegion(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  // Operations on meshing region should after initialization.
  if (!sensemanager_thread_.IsRunning()) {
    info->PostResult(ClearMeshingRegion::Results::Create(
          std::string(),
          std::string("Wrong state to clearMeshingRegion.")));
    return;
  }
  if (scene_perception_->ClearMeshingRegion()
      < PXC_STATUS_NO_ERROR) {
    info->PostResult(ClearMeshingRegion::Results::Create(
          std::string(),
          std::string("Failed to clearMeshingRegion.")));
    return;
  }
  info->PostResult(ClearMeshingRegion::Results::Create(
        std::string("Succeeded to clearMeshingRegion."),
        std::string()));
}

}  // namespace scene_perception
}  // namespace realsense
