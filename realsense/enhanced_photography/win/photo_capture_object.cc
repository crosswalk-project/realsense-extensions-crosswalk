// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/photo_capture_object.h"

#include <algorithm>
#include <string>

#include "base/bind.h"
#include "base/guid.h"
#include "base/logging.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

// Default preview config.
// FIXME(qjia7): Enumerate available device configuration and select one.
static int kCaptureColorWidth = 640;
static int kCaptureColorHeight = 480;
static int kCaptureDepthWidth = 480;
static int kCaptureDepthHeight = 360;
static float kCaptureFramerate = 60.0;

PhotoCaptureObject::PhotoCaptureObject(
    EnhancedPhotographyInstance* instance)
        : state_(IDLE),
          on_preview_(false),
          ep_preview_thread_("PhotoCapturePreviewThread"),
          message_loop_(base::MessageLoopProxy::current()),
          session_(nullptr),
          sense_manager_(nullptr),
          preview_photo_(nullptr),
          preview_image_(nullptr),
          instance_(instance),
          binary_message_size_(0) {
  handler_.Register("startPreview",
                    base::Bind(&PhotoCaptureObject::OnStartPreview,
                               base::Unretained(this)));
  handler_.Register("stopPreview",
                    base::Bind(&PhotoCaptureObject::OnStopPreview,
                               base::Unretained(this)));
  handler_.Register("getPreviewImage",
                    base::Bind(&PhotoCaptureObject::OnGetPreviewImage,
                               base::Unretained(this)));
  handler_.Register("takePhoto",
                    base::Bind(&PhotoCaptureObject::OnTakePhoto,
                               base::Unretained(this)));
  session_ = PXCSession::CreateInstance();
}

PhotoCaptureObject::~PhotoCaptureObject() {
  if (state_ != IDLE) {
    OnStopPreview(nullptr);
  } else {
    ReleaseMainResources();
  }
}

void PhotoCaptureObject::CreateDepthPhotoObject(
    PXCPhoto* pxcphoto, jsapi::depth_photo::Photo* photo) {
  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance_);
  depthPhotoObject->GetPhoto()->CopyPhoto(pxcphoto);
  scoped_ptr<BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance_->AddBindingObject(object_id, obj.Pass());
  photo->object_id = object_id;
}

void PhotoCaptureObject::StartEvent(const std::string& type) {
  if (type == std::string("preview")) {
    on_preview_ = true;
  }
}

void PhotoCaptureObject::StopEvent(const std::string& type) {
  if (type == std::string("preview")) {
    on_preview_ = false;
  }
}

void PhotoCaptureObject::OnStartPreview(
  scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (state_ == PREVIEW) {
    info->PostResult(StartPreview::Results::Create(std::string("Success"),
                                                   std::string()));
    return;
  }

  scoped_ptr<StartPreview::Params> params(
      StartPreview::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        StartPreview::Results::Create(std::string(), "Malformed parameters"));
    return;
  }

  sense_manager_ = session_->CreateSenseManager();

  if (!sense_manager_) {
    info->PostResult(StartPreview::Results::Create(std::string(),
        "Failed to create sense manager"));
    return;
  }

  if (params->config) {
    if (params->config->color_width)
      kCaptureColorWidth = *(params->config->color_width.get());
    if (params->config->color_height)
      kCaptureColorHeight = *(params->config->color_height.get());
    if (params->config->depth_width)
      kCaptureDepthWidth = *(params->config->depth_width.get());
    if (params->config->depth_height)
      kCaptureDepthHeight = *(params->config->depth_height.get());
    if (params->config->framerate)
      kCaptureFramerate = *(params->config->framerate.get());
  }

  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_COLOR,
                               kCaptureColorWidth,
                               kCaptureColorHeight,
                               kCaptureFramerate);
  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_DEPTH,
                               kCaptureDepthWidth,
                               kCaptureDepthHeight,
                               kCaptureFramerate);

  if (sense_manager_->Init() < PXC_STATUS_NO_ERROR) {
    ReleasePreviewResources();
    info->PostResult(StartPreview::Results::Create(std::string(),
        "Init Failed"));
    return;
  }

  PXCImage::ImageInfo image_info;
  memset(&image_info, 0, sizeof(image_info));
  image_info.width = kCaptureColorWidth;
  image_info.height = kCaptureColorHeight;
  image_info.format = PXCImage::PIXEL_FORMAT_RGB32;
  preview_image_ = sense_manager_->QuerySession()->CreateImage(&image_info);

  preview_photo_ = sense_manager_->QuerySession()->CreatePhoto();

  {
    base::AutoLock lock(lock_);
    state_ = PREVIEW;
  }

  if (!ep_preview_thread_.IsRunning())
    ep_preview_thread_.Start();


  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::OnEnhancedPhotoPreviewPipeline,
                 base::Unretained(this)));

  info->PostResult(StartPreview::Results::Create(std::string("success"),
                                                 std::string()));
}

void PhotoCaptureObject::OnEnhancedPhotoPreviewPipeline() {
  DCHECK_EQ(ep_preview_thread_.message_loop(), base::MessageLoop::current());
  if (state_ == IDLE) return;

  pxcStatus status = sense_manager_->AcquireFrame(true);
  if (status < PXC_STATUS_NO_ERROR) {
    ErrorEvent event;
    event.status = "Fail to AcquireFrame. Stop preview.";
    scoped_ptr<base::ListValue> eventData(new base::ListValue);
    eventData->Append(event.ToValue().release());
    DispatchEvent("error", eventData.Pass());
    {
      base::AutoLock lock(lock_);
      state_ = IDLE;
    }

    ReleasePreviewResources();
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QuerySample();
  if (sample->color) {
    if (on_preview_) {
      preview_image_->CopyImage(sample->color);
      DispatchEvent("preview");
    }
  }

  // Go fetching the next samples
  sense_manager_->ReleaseFrame();
  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::OnEnhancedPhotoPreviewPipeline,
                 base::Unretained(this)));
}

void PhotoCaptureObject::OnGetPreviewImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  if (state_ != PREVIEW) {
    info->PostResult(GetPreviewImage::Results::Create(img,
        "It's not in preview mode."));
    return;
  }

  if (!CopyColorImage(preview_image_)) {
    info->PostResult(GetPreviewImage::Results::Create(img,
        "Failed to get preview image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
  return;
}

void PhotoCaptureObject::OnTakePhoto(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  if (state_ != PREVIEW) {
    info->PostResult(TakePhoto::Results::Create(photo,
        "It's not in preview mode."));
    return;
  }

  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::CaptureOnPreviewThread,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void PhotoCaptureObject::CaptureOnPreviewThread(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  pxcStatus status = sense_manager_->AcquireFrame(true);
  if (status < PXC_STATUS_NO_ERROR) {
    info->PostResult(TakePhoto::Results::Create(photo,
        "Failed to AcquireFrame"));
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QuerySample();
  preview_photo_->ImportFromPreviewSample(sample);
  PXCPhoto* pxcphoto = session_->CreatePhoto();
  pxcphoto->CopyPhoto(preview_photo_);
  CreateDepthPhotoObject(pxcphoto, &photo);
  sense_manager_->ReleaseFrame();
  info->PostResult(TakePhoto::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void PhotoCaptureObject::OnStopPreview(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (state_ == IDLE && info) {
    info->PostResult(StopPreview::Results::Create(std::string(),
        "Please startPreview() first"));
    return;
  }
  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&PhotoCaptureObject::OnStopAndDestroyPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
  ep_preview_thread_.Stop();
}

void PhotoCaptureObject::OnStopAndDestroyPipeline(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(ep_preview_thread_.message_loop(), base::MessageLoop::current());

  {
    base::AutoLock lock(lock_);
    state_ = IDLE;
  }
  if (info) {
    ReleasePreviewResources();
    info->PostResult(StopPreview::Results::Create(std::string("Success"),
                                                  std::string()));
  } else {
    ReleasePreviewResources();
    ReleaseMainResources();
  }
}

bool PhotoCaptureObject::CopyColorImage(PXCImage* pxcimage) {
  if (!pxcimage) return false;

  PXCImage::ImageInfo image_info = pxcimage->QueryInfo();
  PXCImage::ImageData image_data;
  if (pxcimage->AcquireAccess(PXCImage::ACCESS_READ,
      PXCImage::PIXEL_FORMAT_RGB32, &image_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  // binary image message: call_id (i32), width (i32), height (i32),
  // color (int8 buffer, size = width * height * 4)
  size_t requset_size = 4 * 3 + image_info.width * image_info.height * 4;
  if (binary_message_size_ != requset_size) {
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;
  }

  int* int_array = reinterpret_cast<int*>(binary_message_.get());
  int_array[1] = image_info.width;
  int_array[2] = image_info.height;

  uint8_t* rgb32 = reinterpret_cast<uint8_t*>(image_data.planes[0]);
  uint8_t* uint8_data_array =
      reinterpret_cast<uint8_t*>(binary_message_.get() + 3 * sizeof(int));
  int k = 0;
  for (int y = 0; y < image_info.height; y++) {
    for (int x = 0; x < image_info.width; x++) {
      int i = x * 4 + image_data.pitches[0] * y;
      uint8_data_array[k++] = rgb32[i + 2];
      uint8_data_array[k++] = rgb32[i + 1];
      uint8_data_array[k++] = rgb32[i];
      uint8_data_array[k++] = rgb32[i + 3];
    }
  }

  pxcimage->ReleaseAccess(&image_data);
  return true;
}

void PhotoCaptureObject::ReleasePreviewResources() {
  if (preview_image_) {
    preview_image_->Release();
    preview_image_ = nullptr;
  }
  if (preview_photo_) {
    preview_photo_->Release();
    preview_photo_ = nullptr;
  }
  if (sense_manager_) {
    sense_manager_->Close();
    sense_manager_->Release();
    sense_manager_ = nullptr;
  }
}

void PhotoCaptureObject::ReleaseMainResources() {
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

}  // namespace enhanced_photography
}  // namespace realsense
