// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/enhanced_photography_object.h"

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

EnhancedPhotographyObject::EnhancedPhotographyObject(
    EnhancedPhotographyInstance* instance)
        : state_(IDLE),
          on_preview_(false),
          ep_preview_thread_("EnhancedPhotoPreviewThread"),
          message_loop_(base::MessageLoopProxy::current()),
          session_(nullptr),
          sense_manager_(nullptr),
          ep_(nullptr),
          preview_photo_(nullptr),
          preview_image_(nullptr),
          instance_(instance),
          binary_message_size_(0) {
  handler_.Register("startPreview",
                    base::Bind(&EnhancedPhotographyObject::OnStartPreview,
                               base::Unretained(this)));
  handler_.Register("stopPreview",
                    base::Bind(&EnhancedPhotographyObject::OnStopPreview,
                               base::Unretained(this)));
  handler_.Register("getPreviewImage",
                    base::Bind(&EnhancedPhotographyObject::OnGetPreviewImage,
                               base::Unretained(this)));
  handler_.Register("takePhoto",
                    base::Bind(&EnhancedPhotographyObject::OnTakePhoto,
                               base::Unretained(this)));
  handler_.Register("measureDistance",
                    base::Bind(&EnhancedPhotographyObject::OnMeasureDistance,
                               base::Unretained(this)));
  handler_.Register("depthRefocus",
                    base::Bind(&EnhancedPhotographyObject::OnDepthRefocus,
                               base::Unretained(this)));
  handler_.Register("depthResize",
                    base::Bind(&EnhancedPhotographyObject::OnDepthResize,
                               base::Unretained(this)));
  handler_.Register("enhanceDepth",
                    base::Bind(&EnhancedPhotographyObject::OnEnhanceDepth,
                               base::Unretained(this)));
  handler_.Register("pasteOnPlane",
                    base::Bind(&EnhancedPhotographyObject::OnPasteOnPlane,
                               base::Unretained(this)));
  handler_.Register("computeMaskFromCoordinate",
      base::Bind(&EnhancedPhotographyObject::OnComputeMaskFromCoordinate,
                 base::Unretained(this)));
  handler_.Register("computeMaskFromThreshold",
      base::Bind(&EnhancedPhotographyObject::OnComputeMaskFromThreshold,
                 base::Unretained(this)));
  handler_.Register("depthBlend",
                    base::Bind(&EnhancedPhotographyObject::OnDepthBlend,
                               base::Unretained(this)));
  handler_.Register("objectSegment",
                    base::Bind(&EnhancedPhotographyObject::OnObjectSegment,
                               base::Unretained(this)));
  handler_.Register("refineMask",
                    base::Bind(&EnhancedPhotographyObject::OnRefineMask,
                               base::Unretained(this)));
  handler_.Register("initMotionEffect",
                    base::Bind(&EnhancedPhotographyObject::OnInitMotionEffect,
                               base::Unretained(this)));
  handler_.Register("applyMotionEffect",
                    base::Bind(&EnhancedPhotographyObject::OnApplyMotionEffect,
                               base::Unretained(this)));
  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

EnhancedPhotographyObject::~EnhancedPhotographyObject() {
  if (state_ != IDLE) {
    OnStopPreview(nullptr);
  } else {
    ReleaseMainResources();
  }
}

void EnhancedPhotographyObject::CreateDepthPhotoObject(
    PXCPhoto* pxcphoto, jsapi::depth_photo::Photo* photo) {
  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance_);
  depthPhotoObject->GetPhoto()->CopyPhoto(pxcphoto);
  scoped_ptr<BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance_->AddBindingObject(object_id, obj.Pass());
  photo->object_id = object_id;
}

void EnhancedPhotographyObject::StartEvent(const std::string& type) {
  if (type == std::string("preview")) {
    on_preview_ = true;
  }
}

void EnhancedPhotographyObject::StopEvent(const std::string& type) {
  if (type == std::string("preview")) {
    on_preview_ = false;
  }
}

void EnhancedPhotographyObject::OnStartPreview(
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
      base::Bind(&EnhancedPhotographyObject::OnEnhancedPhotoPreviewPipeline,
                 base::Unretained(this)));

  info->PostResult(StartPreview::Results::Create(std::string("success"),
                                                 std::string()));
}

void EnhancedPhotographyObject::OnEnhancedPhotoPreviewPipeline() {
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
      base::Bind(&EnhancedPhotographyObject::OnEnhancedPhotoPreviewPipeline,
                 base::Unretained(this)));
}

void EnhancedPhotographyObject::OnGetPreviewImage(
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

void EnhancedPhotographyObject::OnTakePhoto(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  if (state_ != PREVIEW) {
    info->PostResult(TakePhoto::Results::Create(photo,
        "It's not in preview mode."));
    return;
  }

  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&EnhancedPhotographyObject::CaptureOnPreviewThread,
                 base::Unretained(this),
                 base::Passed(&info)));
}

void EnhancedPhotographyObject::CaptureOnPreviewThread(
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

void EnhancedPhotographyObject::OnStopPreview(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (state_ == IDLE && info) {
    info->PostResult(StopPreview::Results::Create(std::string(),
        "Please startPreview() first"));
    return;
  }
  ep_preview_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&EnhancedPhotographyObject::OnStopAndDestroyPipeline,
                 base::Unretained(this),
                 base::Passed(&info)));
  ep_preview_thread_.Stop();
}

void EnhancedPhotographyObject::OnMeasureDistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Distance distance;
  scoped_ptr<MeasureDistance::Params> params(
      MeasureDistance::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        MeasureDistance::Results::Create(distance, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(MeasureDistance::Results::Create(distance,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCPointI32 start;
  PXCPointI32 end;
  start.x = params->start.x;
  start.y = params->start.y;
  end.x = params->end.x;
  end.y = params->end.y;
  PXCEnhancedPhoto::MeasureData data;
  ep_->MeasureDistance(depthPhotoObject->GetPhoto(), start, end, &data);

  distance.distance = data.distance;
  info->PostResult(MeasureDistance::Results::Create(distance, std::string()));
}

void EnhancedPhotographyObject::OnDepthRefocus(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<DepthRefocus::Params> params(
      DepthRefocus::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        DepthRefocus::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(DepthRefocus::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCPointI32 focus;
  focus.x = params->focus.x;
  focus.y = params->focus.y;

  double aperture = params->aperture;

  PXCPhoto* pxcphoto = ep_->DepthRefocus(depthPhotoObject->GetPhoto(),
                                         focus,
                                         aperture);
  if (!pxcphoto) {
    info->PostResult(DepthRefocus::Results::Create(photo,
        "Failed to operate DepthRefocus"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(DepthRefocus::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void EnhancedPhotographyObject::OnDepthResize(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<DepthResize::Params> params(
      DepthResize::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        DepthResize::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(DepthResize::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCSizeI32 size;
  size.width = params->size.width;
  size.height = params->size.height;

  PXCPhoto* pxcphoto = ep_->DepthResize(depthPhotoObject->GetPhoto(), size);
  if (!pxcphoto) {
    info->PostResult(DepthResize::Results::Create(photo,
        "Failed to operate DepthResize"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(DepthResize::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void EnhancedPhotographyObject::OnEnhanceDepth(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<EnhanceDepth::Params> params(
      EnhanceDepth::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        EnhanceDepth::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
    instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(EnhanceDepth::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  DepthFillQuality quality = params->quality;
  PXCEnhancedPhoto::DepthFillQuality pxcquality;
  if (quality == DepthFillQuality::DEPTH_FILL_QUALITY_HIGH)
    pxcquality = PXCEnhancedPhoto::DepthFillQuality::HIGH;
  else
    pxcquality = PXCEnhancedPhoto::DepthFillQuality::LOW;

  PXCPhoto* pxcphoto = ep_->EnhanceDepth(depthPhotoObject->GetPhoto(),
                                         pxcquality);
  if (!pxcphoto) {
    info->PostResult(EnhanceDepth::Results::Create(photo,
        "Failed to operate EnhanceDepth"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(EnhanceDepth::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void EnhancedPhotographyObject::OnPasteOnPlane(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<PasteOnPlane::Params> params(
      PasteOnPlane::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        PasteOnPlane::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(PasteOnPlane::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCImage::ImageInfo img_info;
  PXCImage::ImageData img_data;
  memset(&img_info, 0, sizeof(img_info));
  memset(&img_data, 0, sizeof(img_data));

  img_info.width = params->image.width;
  img_info.height = params->image.height;
  img_info.format = PXCImage::PIXEL_FORMAT_RGB32;

  int bufSize = img_info.width * img_info.height * 4;
  img_data.planes[0] = new BYTE[bufSize];
  img_data.pitches[0] = img_info.width * 4;
  img_data.format = img_info.format;

  for (int y = 0; y < img_info.height; y++) {
    for (int x = 0; x < img_info.width; x++) {
      int i = x * 4 + img_data.pitches[0] * y;
      img_data.planes[0][i] = params->image.data[i + 2];
      img_data.planes[0][i + 1] = params->image.data[i + 1];
      img_data.planes[0][i + 2] = params->image.data[i];
      img_data.planes[0][i + 3] = params->image.data[i + 3];
    }
  }

  PXCImage* pxcimg = session_->CreateImage(&img_info, &img_data);

  PXCPointI32 start, end;
  start.x = params->top_left.x;
  start.y = params->top_left.y;

  end.x = params->bottom_left.x;
  end.y = params->bottom_left.y;

  PXCPhoto* pxcphoto = ep_->PasteOnPlane(depthPhotoObject->GetPhoto(),
                                         pxcimg,
                                         start,
                                         end);
  if (!pxcphoto) {
    info->PostResult(PasteOnPlane::Results::Create(photo,
        "Failed to operate PasteOnPlane"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(PasteOnPlane::Results::Create(photo, std::string()));

  pxcimg->Release();
  pxcphoto->Release();
  delete img_data.planes[0];
}

void EnhancedPhotographyObject::OnDepthBlend(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<DepthBlend::Params> params(
      DepthBlend::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        DepthBlend::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::vector<char> buffer = params->buffer;
  char* data = &buffer[0];
  int offset = 0;
  int* int_array = reinterpret_cast<int*>(data);
  int object_id_len = int_array[0];
  int aligned_object_id_len = object_id_len + 4 - object_id_len % 4;
  offset += sizeof(int);

  std::string object_id(data + offset, object_id_len);
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(DepthBlend::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  offset += aligned_object_id_len;
  int_array = reinterpret_cast<int*>(data + offset);
  int width = int_array[0];
  int height = int_array[1];
  offset += 2 * sizeof(int);

  PXCImage::ImageInfo img_info;
  PXCImage::ImageData img_data;
  memset(&img_info, 0, sizeof(img_info));
  memset(&img_data, 0, sizeof(img_data));

  img_info.width = width;
  img_info.height = height;
  img_info.format = PXCImage::PIXEL_FORMAT_RGB32;

  int bufSize = img_info.width * img_info.height * 4;
  img_data.planes[0] = new BYTE[bufSize];
  img_data.pitches[0] = img_info.width * 4;
  img_data.format = img_info.format;

  uint8_t* image_data = reinterpret_cast<uint8_t*>(data + offset);
  offset += bufSize;

  for (int y = 0; y < img_info.height; y++) {
    for (int x = 0; x < img_info.width; x++) {
      int i = x * 4 + img_data.pitches[0] * y;
      img_data.planes[0][i] = image_data[i + 2];
      img_data.planes[0][i + 1] = image_data[i + 1];
      img_data.planes[0][i + 2] = image_data[i];
      img_data.planes[0][i + 3] = image_data[i + 3];
    }
  }

  PXCImage* pxcimg = session_->CreateImage(&img_info, &img_data);

  int_array = reinterpret_cast<int*>(data + offset);
  int point_x = int_array[0];
  int point_y = int_array[1];
  int depth = int_array[2];
  int pitch = int_array[3];
  int yaw = int_array[4];
  int roll = int_array[5];
  PXCPointI32 point;
  point.x = point_x;
  point.y = point_y;

  pxcI32 rotation[3];
  rotation[0] = pitch;
  rotation[1] = yaw;
  rotation[2] = roll;
  offset += 6 * sizeof(int);

  float_t* float_array = reinterpret_cast<float_t*>(data + offset);
  float_t scale = float_array[0];

  PXCPhoto* pxcphoto = ep_->DepthBlend(depthPhotoObject->GetPhoto(),
                                       pxcimg,
                                       point,
                                       depth,
                                       rotation,
                                       scale);

  if (!pxcphoto) {
    info->PostResult(DepthBlend::Results::Create(photo,
        "Failed to operate DepthBlend"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(DepthBlend::Results::Create(photo, std::string()));

  pxcimg->Release();
  pxcphoto->Release();
  delete img_data.planes[0];
}

void EnhancedPhotographyObject::OnInitMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  scoped_ptr<InitMotionEffect::Params> params(
      InitMotionEffect::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(InitMotionEffect::Results::Create(
        std::string(), "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(InitMotionEffect::Results::Create(std::string(),
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  pxcStatus sts = ep_->InitMotionEffect(depthPhotoObject->GetPhoto());
  if (sts < PXC_STATUS_NO_ERROR) {
    info->PostResult(InitMotionEffect::Results::Create(
        std::string(), "InitMotionEffect failed"));
    return;
  }

  info->PostResult(
      InitMotionEffect::Results::Create(std::string("Success"), std::string()));
}

void EnhancedPhotographyObject::OnApplyMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  scoped_ptr<ApplyMotionEffect::Params> params(
      ApplyMotionEffect::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        ApplyMotionEffect::Results::Create(img, "Malformed parameters"));
    return;
  }

  DCHECK(ep_);
  pxcF32 motion[3];
  motion[0] = params->motion.horizontal;
  motion[1] = params->motion.vertical;
  motion[2] = params->motion.distance;

  pxcF32 rotation[3];
  rotation[0] = params->rotation.pitch;
  rotation[1] = params->rotation.yaw;
  rotation[2] = params->rotation.roll;

  PXCImage* pxcimage = ep_->ApplyMotionEffect(motion, rotation, params->zoom);

  if (!pxcimage) {
    info->PostResult(ApplyMotionEffect::Results::Create(img,
        "Failed to operate ApplyMotionEffect"));
    return;
  }

  if (!CopyColorImage(pxcimage)) {
    info->PostResult(ApplyMotionEffect::Results::Create(img,
        "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimage->Release();
}

void EnhancedPhotographyObject::OnComputeMaskFromCoordinate(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::MaskImage image;
  scoped_ptr<ComputeMaskFromCoordinate::Params> params(
      ComputeMaskFromCoordinate::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(ComputeMaskFromCoordinate::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(ComputeMaskFromCoordinate::Results::Create(image,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCPointI32 point;
  point.x = params->point.x;
  point.y = params->point.y;

  PXCImage* pxcimage =
      ep_->ComputeMaskFromCoordinate(depthPhotoObject->GetPhoto(), point);
  if (!CopyMaskImage(pxcimage)) {
    info->PostResult(ComputeMaskFromCoordinate::Results::Create(image,
        "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimage->Release();
}

void EnhancedPhotographyObject::OnComputeMaskFromThreshold(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::MaskImage image;
  scoped_ptr<ComputeMaskFromThreshold::Params> params(
      ComputeMaskFromThreshold::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(ComputeMaskFromThreshold::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(ComputeMaskFromThreshold::Results::Create(image,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);

  PXCImage* pxcimage = ep_->ComputeMaskFromThreshold(
      depthPhotoObject->GetPhoto(), params->threshold);
  if (!CopyMaskImage(pxcimage)) {
    info->PostResult(ComputeMaskFromThreshold::Results::Create(image,
      "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimage->Release();
}

void EnhancedPhotographyObject::OnObjectSegment(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;
  scoped_ptr<ObjectSegment::Params> params(
      ObjectSegment::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(ObjectSegment::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(ObjectSegment::Results::Create(image,
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  PXCPointI32 start, end;
  start.x = std::min(params->top_left.x, params->bottom_right.x);
  start.y = std::min(params->top_left.y, params->bottom_right.y);
  end.x = std::max(params->top_left.x, params->bottom_right.x);
  end.y = std::max(params->top_left.y, params->bottom_right.y);

  PXCImage* pxcimage =
      ep_->ObjectSegment(depthPhotoObject->GetPhoto(), start, end);
  if (!CopyMaskImage(pxcimage)) {
    info->PostResult(ObjectSegment::Results::Create(image,
        "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimage->Release();
}

void EnhancedPhotographyObject::OnRefineMask(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;
  const base::Value* image_value = NULL;
  const base::BinaryValue* binary_value = NULL;
  if (info->arguments()->Get(0, &image_value) &&
      !image_value->IsType(base::Value::TYPE_NULL)) {
    if (!image_value->IsType(base::Value::TYPE_BINARY)) {
      info->PostResult(RefineMask::Results::Create(
          image, "Malformed parameters"));
      return;
    } else {
      binary_value = static_cast<const base::BinaryValue*>(image_value);
    }
  } else {
    info->PostResult(RefineMask::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  DCHECK(ep_);
  const char* data = binary_value->GetBuffer();
  const int* int_array = reinterpret_cast<const int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  const char* image_data_buffer = data + 2 * sizeof(int);

  PXCImage::ImageInfo img_info;
  PXCImage::ImageData img_data;
  memset(&img_info, 0, sizeof(img_info));
  memset(&img_data, 0, sizeof(img_data));

  img_info.width = width;
  img_info.height = height;
  img_info.format = PXCImage::PIXEL_FORMAT_Y8;

  int bufSize = img_info.width * img_info.height;
  img_data.planes[0] = new BYTE[bufSize];
  img_data.pitches[0] = img_info.width;
  img_data.format = img_info.format;

  for (int y = 0; y < img_info.height; y++) {
    for (int x = 0; x < img_info.width; x++) {
      int i = x + img_data.pitches[0] * y;
      img_data.planes[0][i] = image_data_buffer[i];
    }
  }

  PXCImage* pxcimg = session_->CreateImage(&img_info, &img_data);

  PXCImage* pxc_mask_image = ep_->RefineMask(pxcimg);
  if (!CopyMaskImage(pxc_mask_image)) {
    info->PostResult(RefineMask::Results::Create(image,
        "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimg->Release();
  pxc_mask_image->Release();
  delete img_data.planes[0];
}

void EnhancedPhotographyObject::OnStopAndDestroyPipeline(
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

bool EnhancedPhotographyObject::CopyColorImage(PXCImage* pxcimage) {
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

bool EnhancedPhotographyObject::CopyMaskImage(PXCImage* mask) {
  if (!mask) return false;

  PXCImage::ImageInfo mask_info = mask->QueryInfo();
  PXCImage::ImageData mask_data;
  if (mask->AcquireAccess(PXCImage::ACCESS_READ,
      mask_info.format, &mask_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  size_t requset_size;
  int k = 0;
  if (mask_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_Y8) {
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (int8 buffer, size = width * height)
    requset_size = 4 * 3 + mask_info.width * mask_info.height;
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message_.get());
    int_array[1] = mask_info.width;
    int_array[2] = mask_info.height;

    uint8_t* uint8_data_array = reinterpret_cast<uint8_t*>(
        binary_message_.get() + 3 * sizeof(int));
    for (int y = 0; y < mask_info.height; ++y) {
      for (int x = 0; x < mask_info.width; ++x) {
        uint8_t* depth8 = reinterpret_cast<uint8_t*>(
            mask_data.planes[0] + mask_data.pitches[0] * y);
        uint8_data_array[k++] = depth8[x];
      }
    }
  } else if (mask_info.format ==
      PXCImage::PixelFormat::PIXEL_FORMAT_DEPTH_F32) {
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (float_t buffer, size = width * height *4)
    requset_size = 3 * 4 + mask_info.width * mask_info.height * 4;
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message_.get());
    int_array[1] = mask_info.width;
    int_array[2] = mask_info.height;

    float_t* float_data_array = reinterpret_cast<float_t*>(
        binary_message_.get() + 3 * sizeof(int));
    for (int y = 0; y < mask_info.height; ++y) {
      for (int x = 0; x < mask_info.width; ++x) {
        float_t* depth32 = reinterpret_cast<float_t*>(
            mask_data.planes[0] + mask_data.pitches[0] * y);
        float_data_array[k++] = depth32[x];
      }
    }
  }

  mask->ReleaseAccess(&mask_data);
  return true;
}

void EnhancedPhotographyObject::ReleasePreviewResources() {
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

void EnhancedPhotographyObject::ReleaseMainResources() {
  if (ep_) {
    ep_->Release();
    ep_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

}  // namespace enhanced_photography
}  // namespace realsense
