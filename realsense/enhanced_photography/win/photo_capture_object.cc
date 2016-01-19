// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/photo_capture_object.h"

#include <algorithm>
#include <string>

#include "base/bind.h"
#include "base/guid.h"
#include "base/logging.h"
#include "base/strings/sys_string_conversions.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

using realsense::jsapi::photo_utils::DepthMapQuality;

#define PXC_SUCCEEDED(status) (((pxcStatus)(status)) >= PXC_STATUS_NO_ERROR)
#define PXC_FAILED(status) (((pxcStatus)(status)) < PXC_STATUS_NO_ERROR)
#define DISPATCH_ERROR_AND_CLEAR(e, m) \
    DispatchErrorEvent(e, m); \
    ReleaseResources();

PhotoCaptureObject::PhotoCaptureObject(
    EnhancedPhotographyInstance* instance)
        : depth_enabled_(false),
          on_depthquality_(false),
          pipeline_thread_("PhotoCaptureThread"),
          message_loop_(base::MessageLoopProxy::current()),
          session_(nullptr),
          sense_manager_(nullptr),
          depth_image_(nullptr),
          photo_utils_(nullptr),
          instance_(instance),
          binary_message_size_(0) {
  handler_.Register("enableDepthStream",
                    base::Bind(&PhotoCaptureObject::OnEnableDepthStream,
                               base::Unretained(this)));
  handler_.Register("disableDepthStream",
                    base::Bind(&PhotoCaptureObject::OnDisableDepthStream,
                               base::Unretained(this)));
  handler_.Register("getDepthImage",
                    base::Bind(&PhotoCaptureObject::OnGetDepthImage,
                               base::Unretained(this)));
  handler_.Register("takePhoto",
                    base::Bind(&PhotoCaptureObject::OnTakePhoto,
                               base::Unretained(this)));
}

PhotoCaptureObject::~PhotoCaptureObject() {
  {
    base::AutoLock lock(lock_);
    if (!depth_enabled_) return;
  }
  OnDisableDepthStream(nullptr);
}

void PhotoCaptureObject::StartEvent(const std::string& type) {
  if (type == std::string("depthquality")) {
    on_depthquality_ = true;
  }
}

void PhotoCaptureObject::StopEvent(const std::string& type) {
  if (type == std::string("depthquality")) {
    on_depthquality_ = false;
  }
}

void PhotoCaptureObject::OnEnableDepthStream(
  scoped_ptr<XWalkExtensionFunctionInfo> info) {
  {
    base::AutoLock lock(lock_);
    if (depth_enabled_) return;
  }

  scoped_ptr<EnableDepthStream::Params> params(
      EnableDepthStream::Params::Create(*info->arguments()));
  if (!params) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_PARAM_UNSUPPORTED,
                             "Failed to get parameters.");
    return;
  }
  std::string cameraName = params->camera;

  session_ = PXCSession::CreateInstance();
  if (!session_) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to create PXCSession.")
    return;
  }

  PXCSession::ImplDesc templat = {};
  templat.group = PXCSession::IMPL_GROUP_SENSOR;
  templat.subgroup = PXCSession::IMPL_SUBGROUP_VIDEO_CAPTURE;
  PXCSession::ImplDesc desc;
  int module_index = 0;
  while (PXC_SUCCEEDED(session_->QueryImpl(&templat, module_index, &desc))) {
    if (PXC_FAILED(session_->CreateImpl<PXCCapture>(&desc, &capture_)))
      continue;

    DVLOG(1) << "RSSDK capture module: " << desc.friendlyName;

    for (int i = 0; i < capture_->QueryDeviceNum(); i++) {
      PXCCapture::DeviceInfo device_info;
      if (PXC_FAILED(capture_->QueryDeviceInfo(i, &device_info))) break;

      if (cameraName == base::SysWideToUTF8(device_info.name)) {
        capture_device_ = capture_->CreateDevice(device_info.didx);
        DVLOG(1) << "Found capture device: "
          << base::SysWideToUTF8(device_info.name) << " "
          << base::SysWideToUTF8(device_info.did);
        break;
      }
    }
    if (capture_device_)
      break;
    module_index++;
    capture_->Release();
  }

  if (!capture_device_) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to create capture device.");
    return;
  }

  int num_profiles = capture_device_->QueryStreamProfileSetNum(
      PXCCapture::STREAM_TYPE_COLOR | PXCCapture::STREAM_TYPE_DEPTH);
  DVLOG(1) << "Found " << num_profiles << " profiles.";
  PXCCapture::Device::StreamProfileSet profile_set = {};
  // Use the first profile by default.
  // TODO(huningxin): select profile by depth stream config.
  if (PXC_FAILED(capture_device_->QueryStreamProfileSet(
    PXCCapture::STREAM_TYPE_COLOR | PXCCapture::STREAM_TYPE_DEPTH,
    0, &profile_set))) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to query stream profile set.");
    return;
  }

  DVLOG(1) << "Profile: "
    << PXCImage::PixelFormatToString(profile_set.color.imageInfo.format)
    << " (" << profile_set.color.imageInfo.width << "x"
    << profile_set.color.imageInfo.height << ")"
    << " @" << profile_set.color.frameRate.max << "fps "
    << PXCImage::PixelFormatToString(profile_set.depth.imageInfo.format)
    << " (" << profile_set.depth.imageInfo.width << "x"
    << profile_set.color.imageInfo.height << ")"
    << " @" << profile_set.depth.frameRate.max << "fps";

  sense_manager_ = session_->CreateSenseManager();
  if (!sense_manager_) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to create sense manager.");
    return;
  }

  PXCCaptureManager* capture_manager = sense_manager_->QueryCaptureManager();
  if (!capture_manager) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to query capture manager.");
    return;
  }
  capture_manager->FilterByStreamProfiles(&profile_set);

  PXCVideoModule::DataDesc data_desc = {};
  data_desc.streams.color.frameRate.min =
      data_desc.streams.color.frameRate.max =
          profile_set.color.frameRate.max;
  data_desc.streams.color.sizeMin.height =
      data_desc.streams.color.sizeMax.height =
          profile_set.color.imageInfo.height;
  data_desc.streams.color.sizeMin.width =
      data_desc.streams.color.sizeMax.width =
          profile_set.color.imageInfo.width;
  data_desc.streams.color.options = profile_set.color.options;
  data_desc.streams.depth.frameRate.min =
      data_desc.streams.depth.frameRate.max =
          profile_set.depth.frameRate.max;
  data_desc.streams.depth.sizeMin.height =
      data_desc.streams.depth.sizeMax.height =
          profile_set.depth.imageInfo.height;
  data_desc.streams.depth.sizeMin.width =
      data_desc.streams.depth.sizeMax.width =
          profile_set.depth.imageInfo.width;
  data_desc.streams.depth.options = profile_set.depth.options;

  if (PXC_FAILED(sense_manager_->EnableStreams(&data_desc))) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to enable depth stream.");
    return;
  }

  if (PXC_FAILED(sense_manager_->Init())) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to init sense manager.");
    return;
  }

  PXCCapture::Device* capture_device = capture_manager->QueryDevice();
  if (!capture_device) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to query device.");
    return;
  }

  if (PXC_FAILED(capture_device->QueryStreamProfileSet(&profile_set))) {
    DISPATCH_ERROR_AND_CLEAR(
        ERROR_CODE_INIT_FAILED,
        "Failed to query stream profile set after sense manager init.");
    return;
  }

  PXCCapture::Device::StreamProfile color = profile_set.color;
  PXCCapture::Device::StreamProfile depth = profile_set.depth;

  if (!color.imageInfo.format || !depth.imageInfo.format) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to get color and depth stream profile.");
    return;
  }

  DVLOG(1) << "Set color stream profile: "
      << "format " << color.imageInfo.format
      << " (" << color.imageInfo.width << "x"
      << color.imageInfo.height << ")"
      << " @" << color.frameRate.max << "fps";

  DVLOG(1) << "Set depth stream profile: "
      << "format " << depth.imageInfo.format
      << " (" << depth.imageInfo.width << "x"
      << depth.imageInfo.height << ")"
      << " @" << depth.frameRate.max << "fps";

  PXCImage::ImageInfo image_info;
  memset(&image_info, 0, sizeof(image_info));
  image_info.width = depth.imageInfo.width;
  image_info.height = depth.imageInfo.height;
  image_info.format = PXCImage::PIXEL_FORMAT_DEPTH;
  depth_image_ = session_->CreateImage(&image_info);

  photo_utils_ = PXCEnhancedPhoto::PhotoUtils::CreateInstance(session_);
  if (!photo_utils_) {
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_INIT_FAILED,
                             "Failed to create photo utils instance.");
    return;
  }

  {
    base::AutoLock lock(lock_);
    depth_enabled_ = true;
  }

  DCHECK(!pipeline_thread_.IsRunning());

  pipeline_thread_.Start();

  pipeline_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::RunPipeline,
                 base::Unretained(this)));
}

void PhotoCaptureObject::OnDisableDepthStream(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  {
    base::AutoLock lock(lock_);
    if (!depth_enabled_) return;
  }
  pipeline_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::StopAndDestroyPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
  pipeline_thread_.Stop();
}

void PhotoCaptureObject::OnGetDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  {
    base::AutoLock lock(lock_);
    if (!depth_enabled_) {
      Image depth_image;
      info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                         "The depth stream is not enabled."));
      return;
    }
  }

  pipeline_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::DoGetDepthImage,
                 base::Unretained(this),
                 base::Passed(&info)));
  return;
}

void PhotoCaptureObject::OnTakePhoto(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  {
    base::AutoLock lock(lock_);
    if (!depth_enabled_) {
      jsapi::depth_photo::Photo photo;
      info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                         "The depth stream is not enabled."));
      return;
    }
  }

  pipeline_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::DoTakePhoto,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void PhotoCaptureObject::RunPipeline() {
  DCHECK_EQ(pipeline_thread_.message_loop(), base::MessageLoop::current());

  {
    base::AutoLock lock(lock_);
    if (!depth_enabled_) return;
  }

  if (PXC_FAILED(sense_manager_->AcquireFrame(true))) {
    {
      base::AutoLock lock(lock_);
      depth_enabled_ = false;
    }
    DISPATCH_ERROR_AND_CLEAR(ERROR_CODE_EXEC_FAILED,
                             "Failed to acquire frame.");
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QuerySample();
  if (sample->depth) {
    depth_image_->CopyImage(sample->depth);
    if (on_depthquality_) {
      PXCEnhancedPhoto::PhotoUtils::DepthMapQuality quality =
          photo_utils_->GetDepthQuality(sample->depth);
      DepthMapQuality depth_quality(DepthMapQuality::DEPTH_MAP_QUALITY_NONE);
      switch (quality) {
        case PXCEnhancedPhoto::PhotoUtils::DepthMapQuality::BAD: {
          depth_quality = DepthMapQuality::DEPTH_MAP_QUALITY_BAD;
          break;
        }
        case PXCEnhancedPhoto::PhotoUtils::DepthMapQuality::FAIR: {
          depth_quality = DepthMapQuality::DEPTH_MAP_QUALITY_FAIR;
          break;
        }
        case PXCEnhancedPhoto::PhotoUtils::DepthMapQuality::GOOD: {
          depth_quality = DepthMapQuality::DEPTH_MAP_QUALITY_GOOD;
          break;
        }
      }
      DepthQualityEventData eventData;
      eventData.quality = depth_quality;
      scoped_ptr<base::ListValue> data(new base::ListValue);
      data->Append(eventData.ToValue().release());
      DispatchEvent("depthquality", data.Pass());
    }
  }

  // Go fetching the next samples
  sense_manager_->ReleaseFrame();
  pipeline_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::RunPipeline,
                 base::Unretained(this)));
}

void PhotoCaptureObject::DoGetDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!depth_image_) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "Failed to get depth image."));
    return;
  }

  if (!CopyImageToBinaryMessage(depth_image_,
                                binary_message_,
                                &binary_message_size_)) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "Failed to copy depth image."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
}

void PhotoCaptureObject::DoTakePhoto(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (PXC_FAILED(sense_manager_->AcquireFrame(true))) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED));
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QuerySample();
  PXCPhoto* pxcphoto = session_->CreatePhoto();
  pxcphoto->ImportFromPreviewSample(sample);
  jsapi::depth_photo::Photo photo;
  CreateDepthPhotoObject(instance_, pxcphoto, &photo);
  sense_manager_->ReleaseFrame();
  info->PostResult(TakePhoto::Results::Create(photo, std::string()));
}

void PhotoCaptureObject::StopAndDestroyPipeline(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(pipeline_thread_.message_loop(), base::MessageLoop::current());

  {
    base::AutoLock lock(lock_);
    depth_enabled_ = false;
  }

  ReleaseResources();
}

void PhotoCaptureObject::ReleaseResources() {
  if (depth_image_) {
    depth_image_->Release();
    depth_image_ = nullptr;
  }
  if (capture_) {
    capture_->Release();
    capture_ = nullptr;
  }
  if (capture_device_) {
    capture_device_->Release();
    capture_device_ = nullptr;
  }
  if (sense_manager_) {
    sense_manager_->Close();
    sense_manager_->Release();
    sense_manager_ = nullptr;
  }
  if (photo_utils_) {
    photo_utils_->Release();
    photo_utils_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void PhotoCaptureObject::DispatchErrorEvent(const ErrorCode& error,
                                            const std::string& message) {
  ErrorEventData eventData;
  eventData.error = error;
  eventData.message = message;
  scoped_ptr<base::ListValue> data(new base::ListValue);
  data->Append(eventData.ToValue().release());
  DispatchEvent("error", data.Pass());
}

}  // namespace enhanced_photography
}  // namespace realsense
