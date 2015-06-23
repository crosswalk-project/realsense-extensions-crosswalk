// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>
#include <sstream>

#include "realsense/sceneperception/sceneperception_object.h"

#include "base/bind.h"
#include "base/logging.h"
#include "realsense/sceneperception/sceneperception.h"

namespace realsense {
namespace sceneperception {

using namespace jsapi::sceneperception; // NOLINT
using namespace realsense::common; // NOLINT

// Current RSSDK R3 SP module requires this configuration
const int kCaptureWidth = 320;
const int kCaptureHeight = 240;
const float kCaptureFramerate = 60.0;

// Default values of SP module:
//   MaxNumberOfBlockMeshes: 16384
//   MaxNumberOfFaces: 2621440
//   MaxNumberOfVertices: 7864320
// Temporarily set MaxNumberOfBlockMeshes to 1000 for acceptable performance in
// scene perception sample.
const int kMaxNumberOfBlockMeshes = 1000;
const int kMaxNumberOfFaces = 2621440;
const int kMaxNumberOfVertices = 7864320;

ScenePerceptionObject::ScenePerceptionObject() :
    state_(IDLE),
    on_checking_(false),
    on_tracking_(false),
    on_meshing_(false),
    doing_meshing_updating_(false),
    scenemanager_thread_("SceneManagerThread"),
    meshing_thread_("MeshingThread"),
    message_loop_(base::MessageLoopProxy::current()),
    session_(NULL),
    scene_manager_(NULL),
    sceneperception_(NULL),
    block_meshing_data_(NULL) {
  // TODO(ningxin): expose these configrations to JS
  color_image_width_ = depth_image_width_ = kCaptureWidth;
  color_image_height_ = depth_image_height_ = kCaptureHeight;
  color_capture_framerate_ = depth_capture_framerate_ = kCaptureFramerate;
  meshing_update_info_.blockMeshesRequired = 1;
  meshing_update_info_.countOfBlockMeshesRequired = 1;
  meshing_update_info_.blockMeshesRequired = 1;
  meshing_update_info_.countOfVeticesRequired = 1;
  meshing_update_info_.verticesRequired = 1;
  meshing_update_info_.countOfFacesRequired = 1;
  meshing_update_info_.facesRequired = 1;
  meshing_update_info_.colorsRequired = 1;

  last_meshing_time_ = base::TimeTicks::Now();

  handler_.Register("start",
                    base::Bind(&ScenePerceptionObject::OnStart,
                               base::Unretained(this)));
  handler_.Register("stop",
                    base::Bind(&ScenePerceptionObject::OnStop,
                               base::Unretained(this)));
  handler_.Register("reset",
                    base::Bind(&ScenePerceptionObject::OnReset,
                               base::Unretained(this)));
  handler_.Register("enableTracking",
                    base::Bind(&ScenePerceptionObject::OnEnableTracking,
                               base::Unretained(this)));
  handler_.Register("disableTracking",
                    base::Bind(&ScenePerceptionObject::OnDisableTracking,
                               base::Unretained(this)));
  handler_.Register("enableMeshing",
                    base::Bind(&ScenePerceptionObject::OnEnableMeshing,
                               base::Unretained(this)));
  handler_.Register("disableMeshing",
                    base::Bind(&ScenePerceptionObject::OnDisableMeshing,
                               base::Unretained(this)));
}

ScenePerceptionObject::~ScenePerceptionObject() {
  if (state_ != IDLE) {
    OnStop(NULL);
  }
}

void ScenePerceptionObject::ReleaseResources() {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());
  if (block_meshing_data_) {
    block_meshing_data_->Release();
    block_meshing_data_ = NULL;
  }

  if (scene_manager_) {
    scene_manager_->Close();
    scene_manager_->Release();
    scene_manager_ = NULL;
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
  if (scenemanager_thread_.IsRunning()) {
    scenemanager_thread_.Stop();
  }
}

void ScenePerceptionObject::StartEvent(const std::string& type) {
  if (type == std::string("checking")) {
    on_checking_ = true;
  } else if (type == std::string("tracking")) {
    on_tracking_ = true;
  } else if (type == std::string("meshing")) {
    on_meshing_ = true;
  }
}

void ScenePerceptionObject::StopEvent(const std::string& type) {
  if (type == std::string("checking")) {
    on_checking_ = false;
  } else if (type == std::string("tracking")) {
    on_tracking_ = false;
  } else if (type == std::string("meshing")) {
    on_meshing_ = false;
  }
}

void ScenePerceptionObject::OnStart(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (scenemanager_thread_.IsRunning()) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("scenemanager thread is running");
    info->PostResult(error.Pass());
    return;  // Wrong state.
  }
  scenemanager_thread_.Start();

  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnCreateAndStartPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnCreateAndStartPipeline(
      scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ != IDLE) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("state is not IDLE");
    info->PostResult(error.Pass());
    StopSceneManagerThread();
    return;
  }

  session_ = PXCSession::CreateInstance();
  if (!session_) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("failed to create session");
    info->PostResult(error.Pass());
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  // TODO(ningxin): expose this configuration to JS API
  session_->SetCoordinateSystem(PXCSession::COORDINATE_SYSTEM_REAR_OPENCV);

  scene_manager_ = session_->CreateSenseManager();
  if (!scene_manager_) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("failed to create scene manager");
    info->PostResult(error.Pass());
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  scene_manager_->EnableStream(PXCCapture::STREAM_TYPE_COLOR,
                               color_image_width_, color_image_height_,
                               color_capture_framerate_);
  scene_manager_->EnableStream(PXCCapture::STREAM_TYPE_DEPTH,
                               depth_image_width_, depth_image_height_,
                               depth_capture_framerate_);

  pxcStatus status = scene_manager_->EnableScenePerception();
  if (status < PXC_STATUS_NO_ERROR) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("failed to create scene perception module");
    info->PostResult(error.Pass());
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  sceneperception_ = scene_manager_->QueryScenePerception();
  if (sceneperception_ == NULL) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("failed to create scene perception");
    info->PostResult(error.Pass());
    ReleaseResources();
    StopSceneManagerThread();
  }

  scene_manager_->PauseScenePerception(true);
  sceneperception_->EnableSceneReconstruction(false);

  // TODO(ningxin): expose to JS API
  block_meshing_data_ = sceneperception_->CreatePXCBlockMeshingData(
        kMaxNumberOfBlockMeshes, kMaxNumberOfVertices, kMaxNumberOfFaces, 1);

  DLOG(INFO) << "MaxNumberOfBlockMeshes: " <<
      block_meshing_data_->QueryMaxNumberOfBlockMeshes();
  DLOG(INFO) << "MaxNumberOfFaces: " <<
      block_meshing_data_->QueryMaxNumberOfFaces();
  DLOG(INFO) << "MaxNumberOfVertices: " <<
      block_meshing_data_->QueryMaxNumberOfVertices();

  status = scene_manager_->Init();
  if (status < PXC_STATUS_NO_ERROR) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("failed to init pipeline");
    info->PostResult(error.Pass());
    ReleaseResources();
    StopSceneManagerThread();
    return;
  }

  state_ = CHECKING;

  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnRunPipeline,
                 base::Unretained(this)));

  scoped_ptr<base::ListValue> error(new base::ListValue());
  error->AppendString("noerror");
  info->PostResult(error.Pass());
}

void ScenePerceptionObject::OnRunPipeline() {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE)
    return;

  pxcStatus status = scene_manager_->AcquireFrame(true);
  if (status < PXC_STATUS_NO_ERROR) {
    ErrorEvent event;
    event.status = "fail to process next frame";

    scoped_ptr<base::ListValue> eventData(new base::ListValue);
    eventData->Append(event.ToValue().release());

    DispatchEvent("error", eventData.Pass());

    ReleaseResources();
    state_ = IDLE;
    return;
  }

  float image_quality = 0.0;
  PXCCapture::Sample *sample = scene_manager_->QueryScenePerceptionSample();
  if (!sample) {
    // If the SP module is paused, the sample will be NULL.
    // Query the raw color/depth images to support live preview and
    // calculation of scene quality
    sample = scene_manager_->QuerySample();

    if (!sample || !sample->color || !sample->depth) {
      ErrorEvent event;
      event.status = "fail to query sample";

      scoped_ptr<base::ListValue> eventData(new base::ListValue);
      eventData->Append(event.ToValue().release());

      DispatchEvent("error", eventData.Pass());

      ReleaseResources();
      state_ = IDLE;
      return;
    }

    // TODO(ningxin): add onSample event
  }

  if (state_ == CHECKING) {
    if (on_checking_) {
      float image_quality = 0.0;
      if (sample)
        image_quality = sceneperception_->CheckSceneQuality(sample);

      CheckingEvent event;
      event.quality = image_quality;
      scoped_ptr<base::ListValue> eventData(new base::ListValue);
      eventData->Append(event.ToValue().release());

      DispatchEvent("checking", eventData.Pass());
    }
  }

  if ((state_ == TRACKING || state_ == MESHING) && on_tracking_) {
    PXCScenePerception::TrackingAccuracy accuracy =
        sceneperception_->QueryTrackingAccuracy();

    TrackingEvent event;
    event.accuracy = ACCURACY_NONE;
    switch (accuracy) {
      case PXCScenePerception::HIGH:
        event.accuracy = ACCURACY_HIGH;
        break;
      case PXCScenePerception::MED:
        event.accuracy = ACCURACY_MED;
        break;
      case PXCScenePerception::LOW:
        event.accuracy = ACCURACY_LOW;
        break;
      case PXCScenePerception::FAILED:
        event.accuracy = ACCURACY_FAILED;
        break;
    }

    float pose[12];
    sceneperception_->GetCameraPose(pose);
    for (int i = 0; i < 12; ++i) {
      event.camera_pose.push_back(pose[i]);
    }

    scoped_ptr<base::ListValue> eventData(new base::ListValue);
    eventData->Append(event.ToValue().release());

    DispatchEvent("tracking", eventData.Pass());
  }

  if (state_ == MESHING && on_meshing_) {
    // Update meshes
    if (!doing_meshing_updating_ &&
        sceneperception_->IsReconstructionUpdated()) {
      DLOG(INFO) << "Mesh is updated";
      if (base::TimeTicks::Now() - last_meshing_time_ >
          base::TimeDelta::FromMilliseconds(1000)) {
        doing_meshing_updating_ = true;
        DLOG(INFO) << "Request meshing";
        meshing_thread_.message_loop()->PostTask(
            FROM_HERE,
            base::Bind(&ScenePerceptionObject::OnDoMeshingUpdate,
                       base::Unretained(this)));
      }
    }
  }

  scene_manager_->ReleaseFrame();

  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnRunPipeline,
                 base::Unretained(this)));
}

void ScenePerceptionObject::OnStop(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!scenemanager_thread_.IsRunning()) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("scenemanager thread is not running");
    info->PostResult(error.Pass());
    return;  // Wrong state.
  }
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnStopAndDestroyPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
  scenemanager_thread_.Stop();
}

void ScenePerceptionObject::OnStopAndDestroyPipeline(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("state is IDLE");
    info->PostResult(error.Pass());
    return;
  }
  state_ = IDLE;
  ReleaseResources();
  if (info.get()) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("noerror");
    info->PostResult(error.Pass());
  }
}

void ScenePerceptionObject::OnReset(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnResetScenePerception,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnResetScenePerception(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (state_ == IDLE) {
    scoped_ptr<base::ListValue> error(new base::ListValue());
    error->AppendString("state is IDLE");
    info->PostResult(error.Pass());
    return;
  }
  sceneperception_->SetMeshingThresholds(0.0f, 0.0f);
  sceneperception_->Reset();
  block_meshing_data_->Reset();
}

void ScenePerceptionObject::OnPauseScenePerception(
    bool pause, scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (!pause) {
    if (state_ != CHECKING) {
      scoped_ptr<base::ListValue> error(new base::ListValue());
      error->AppendString("state is not CHECKING");
      info->PostResult(error.Pass());
      return;
    }
    state_ = TRACKING;
  } else {
    if (state_ != TRACKING) {
      scoped_ptr<base::ListValue> error(new base::ListValue());
      error->AppendString("state is not TRACKING");
      info->PostResult(error.Pass());
      return;
    }
    state_ = CHECKING;
  }
  scene_manager_->PauseScenePerception(pause);
  scoped_ptr<base::ListValue> error(new base::ListValue());
  error->AppendString("noerror");
  info->PostResult(error.Pass());
}

void ScenePerceptionObject::OnEnableTracking(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnPauseScenePerception,
                 base::Unretained(this),
                 false,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnDisableTracking(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnPauseScenePerception,
                 base::Unretained(this),
                 true,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnEnableReconstruction(
    bool enable, scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  if (enable) {
    if (state_ != TRACKING) {
      scoped_ptr<base::ListValue> error(new base::ListValue());
      error->AppendString("state is not TRACKING");
      info->PostResult(error.Pass());
      return;
    }

    if (meshing_thread_.IsRunning()) {
      scoped_ptr<base::ListValue> error(new base::ListValue());
      error->AppendString("meshing thread is running");
      info->PostResult(error.Pass());
      return;  // Wrong state.
    }
    meshing_thread_.Start();

    state_ = MESHING;
  } else {
    if (state_ != MESHING) {
      scoped_ptr<base::ListValue> error(new base::ListValue());
      error->AppendString("state is not MESHING");
      info->PostResult(error.Pass());
      return;
    }
    if (!meshing_thread_.IsRunning()) {
      return;  // Wrong state.
    }
    meshing_thread_.Stop();

    state_ = TRACKING;
  }
  sceneperception_->EnableSceneReconstruction(enable);
  scoped_ptr<base::ListValue> error(new base::ListValue());
  error->AppendString("noerror");
  info->PostResult(error.Pass());
}

void ScenePerceptionObject::OnEnableMeshing(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnEnableReconstruction,
                 base::Unretained(this),
                 true,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnDisableMeshing(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnEnableReconstruction,
                 base::Unretained(this),
                 false,
                 base::Passed(&info)));
}

void ScenePerceptionObject::OnDoMeshingUpdate() {
  DCHECK_EQ(meshing_thread_.message_loop(), base::MessageLoop::current());
  DLOG(INFO) << "Meshing starts";
  pxcStatus status = sceneperception_->DoMeshingUpdate(block_meshing_data_,
                                                       0,
                                                       &meshing_update_info_);
  sceneperception_->SetMeshingThresholds(0.03f, 0.005f);
  if (status < PXC_STATUS_NO_ERROR)
    return;

  DLOG(INFO) << "Meshing succeeds";

  MeshingEvent event;

  float* vertices = block_meshing_data_->QueryVertices();
  int num_of_vertices = block_meshing_data_->QueryNumberOfVertices();
  event.number_of_vertices = num_of_vertices;
  for (int i = 0; i < 4 * num_of_vertices; ++i) {
    event.vertices.push_back(vertices[i]);
  }

  DLOG(INFO) << "event.number_of_vertices: " << num_of_vertices;
  DLOG(INFO) << "event.vertices: " << event.vertices.size();

  unsigned char* colors = block_meshing_data_->QueryVerticesColor();
  for (int i = 0; i < 3 * num_of_vertices; ++i) {
    event.colors.push_back(colors[i]);
  }
  DLOG(INFO) << "event.colors: " << event.colors.size();

  int* faces = block_meshing_data_->QueryFaces();
  int num_of_faces = block_meshing_data_->QueryNumberOfFaces();
  event.number_of_faces = num_of_faces;
  for (int i = 0; i < 3 * num_of_faces; ++i) {
    event.faces.push_back(faces[i]);
  }

  DLOG(INFO) << "event.number_of_faces: " << num_of_faces;
  DLOG(INFO) << "event.faces: " << event.faces.size();

  int num_of_blockmeshes = block_meshing_data_->QueryNumberOfBlockMeshes();
  PXCBlockMeshingData::PXCBlockMesh *block_mesh_data =
      block_meshing_data_->QueryBlockMeshes();
  for (int i = 0; i < num_of_blockmeshes; ++i, ++block_mesh_data) {
    linked_ptr<BlockMesh> block_mesh(new BlockMesh);
    std::ostringstream id_str;
    id_str << block_mesh_data->meshId;
    block_mesh->mesh_id = id_str.str();
    block_mesh->vertex_start_index = block_mesh_data->vertexStartIndex;
    block_mesh->num_vertices = block_mesh_data->numVertices;
    block_mesh->face_start_index = block_mesh_data->faceStartIndex;
    block_mesh->num_faces = block_mesh_data->numFaces;
    event.block_meshes.push_back(block_mesh);
  }

  scoped_ptr<base::ListValue> eventData(new base::ListValue);
  eventData->Append(event.ToValue().release());

  DispatchEvent("meshing", eventData.Pass());
  DLOG(INFO) << "Dispatch meshing event";

  scenemanager_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&ScenePerceptionObject::OnMeshingResult,
                 base::Unretained(this)));
}

void ScenePerceptionObject::OnMeshingResult() {
  DCHECK_EQ(scenemanager_thread_.message_loop(), base::MessageLoop::current());

  last_meshing_time_ = base::TimeTicks::Now();
  doing_meshing_updating_ = false;
}

}  // namespace sceneperception
}  // namespace realsense
