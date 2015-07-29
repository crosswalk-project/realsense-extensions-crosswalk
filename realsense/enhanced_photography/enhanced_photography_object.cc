// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/enhanced_photography_object.h"

#include <string>

#include "base/bind.h"
#include "base/guid.h"
#include "base/logging.h"
#include "realsense/enhanced_photography/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

// TODO(qjia7): Allow user to config the capture size and framerate
const int kCaptureWidth = 320;
const int kCaptureHeight = 240;
// Align to SP to allow SP and EP work together.
// See https://github.com/otcshare/realsense-extensions-crosswalk/issues/86
const float kCaptureFramerate = 60.0;

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
          instance_(instance) {
  handler_.Register("startPreview",
                    base::Bind(&EnhancedPhotographyObject::OnStartPreview,
                               base::Unretained(this)));
  handler_.Register("stopPreview",
                    base::Bind(&EnhancedPhotographyObject::OnStopPreview,
                               base::Unretained(this)));
  handler_.Register("getPreviewImage",
                    base::Bind(&EnhancedPhotographyObject::OnGetPreviewImage,
                               base::Unretained(this)));
  handler_.Register("takeSnapShot",
                    base::Bind(&EnhancedPhotographyObject::OnTakeSnapShot,
                               base::Unretained(this)));
  handler_.Register("loadFromXMP",
                    base::Bind(&EnhancedPhotographyObject::OnLoadFromXMP,
                                base::Unretained(this)));
  handler_.Register("saveAsXMP",
                     base::Bind(&EnhancedPhotographyObject::OnSaveAsXMP,
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
}

EnhancedPhotographyObject::~EnhancedPhotographyObject() {
  if (state_ != IDLE) {
    OnStopPreview(nullptr);
  } else {
    ReleaseMainResources();
  }
}

bool EnhancedPhotographyObject::CreateSessionInstance() {
  if (session_) {
    return true;
  }

  session_ = PXCSession::CreateInstance();
  if (!session_) {
    return false;
  }
  return true;
}

bool EnhancedPhotographyObject::CreateEPInstance() {
  if (!session_) return false;

  if (ep_) {
    ep_->Release();
    ep_ = nullptr;
  }

  pxcStatus sts = PXC_STATUS_NO_ERROR;
  sts = session_->CreateImpl<PXCEnhancedPhotography>(&ep_);
  if (sts != PXC_STATUS_NO_ERROR) {
    return false;
  }
  return true;
}

void EnhancedPhotographyObject::CreateDepthPhotoObject(PXCPhoto* pxcphoto,
                                                       Photo* photo) {
  std::string object_id = base::GenerateGUID();
  scoped_ptr<BindingObject> obj(new DepthPhotoObject(pxcphoto));
  instance_->AddBindingObject(object_id, obj.Pass());
  photo_objects_.push_back(object_id);

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

  if (!CreateSessionInstance()) {
    info->PostResult(StartPreview::Results::Create(std::string(),
        "Failed to create an SDK session"));
    return;
  }

  sense_manager_ = session_->CreateSenseManager();

  if (!sense_manager_) {
    info->PostResult(StartPreview::Results::Create(std::string(),
        "Failed to create sense manager"));
    return;
  }

  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_COLOR,
                               kCaptureWidth,
                               kCaptureHeight,
                               kCaptureFramerate);
  sense_manager_->EnableStream(PXCCapture::STREAM_TYPE_DEPTH,
                               kCaptureWidth,
                               kCaptureHeight,
                               kCaptureFramerate);

  if (sense_manager_->Init() < PXC_STATUS_NO_ERROR) {
    ReleasePreviewResources();
    info->PostResult(StartPreview::Results::Create(std::string(),
        "Init Failed"));
    return;
  }

  PXCImage::ImageInfo image_info;
  memset(&image_info, 0, sizeof(image_info));
  image_info.width = kCaptureWidth;
  image_info.height = kCaptureHeight;
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
  jsapi::enhanced_photography::Image img;
  if (state_ != PREVIEW) {
    info->PostResult(GetPreviewImage::Results::Create(img,
        "It's not in preview mode."));
    return;
  }

  if (!CopyImage(preview_image_, &img)) {
    info->PostResult(GetPreviewImage::Results::Create(img,
        "Failed to get preview image data."));
    return;
  }

  info->PostResult(GetPreviewImage::Results::Create(img, std::string()));
  return;
}

void EnhancedPhotographyObject::OnTakeSnapShot(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Photo photo;
  if (state_ != PREVIEW) {
    info->PostResult(TakeSnapShot::Results::Create(photo,
        "It's not in preview mode."));
    return;
  }

  if (!CreateEPInstance()) {
    info->PostResult(TakeSnapShot::Results::Create(photo,
        "Failed to create a PXCEnhancedPhotography instance"));
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
  Photo photo;
  pxcStatus status = sense_manager_->AcquireFrame(true);
  if (status < PXC_STATUS_NO_ERROR) {
    info->PostResult(TakeSnapShot::Results::Create(photo,
        "Failed to AcquireFrame"));
    return;
  }

  PXCCapture::Sample *sample = sense_manager_->QuerySample();
  preview_photo_->ImportFromPreviewSample(sample);
  PXCPhoto* pxcphoto = session_->CreatePhoto();
  pxcphoto->CopyPhoto(preview_photo_);
  CreateDepthPhotoObject(pxcphoto, &photo);
  sense_manager_->ReleaseFrame();
  info->PostResult(TakeSnapShot::Results::Create(photo, std::string()));
}

void EnhancedPhotographyObject::OnLoadFromXMP(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Photo photo;
  if (!CreateSessionInstance()) {
    info->PostResult(LoadFromXMP::Results::Create(photo,
        "Failed to create SDK session"));
    return;
  }

  PXCPhoto* pxcphoto = session_->CreatePhoto();

  scoped_ptr<LoadFromXMP::Params> params(
      LoadFromXMP::Params::Create(*info->arguments()));
  const char* file = (params->filepath).c_str();
  // TODO(Qjia7): Check if file exists.
  int size = static_cast<int>(strlen(file)) + 1;
  wchar_t* wfile = new wchar_t[size];
  mbstowcs(wfile, file, size);
  if (pxcphoto->LoadXMP(wfile) < PXC_STATUS_NO_ERROR) {
    pxcphoto->Release();
    pxcphoto = NULL;
    info->PostResult(LoadFromXMP::Results::Create(photo,
        "Failed to LoadXMP. Please check if file path is valid."));
    return;
  }

  if (!CreateEPInstance()) {
    info->PostResult(LoadFromXMP::Results::Create(photo,
        "Failed to create a PXCEnhancedPhotography instance"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(LoadFromXMP::Results::Create(photo, std::string()));
  delete wfile;
}

void EnhancedPhotographyObject::OnSaveAsXMP(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<SaveAsXMP::Params> params(
    SaveAsXMP::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        SaveAsXMP::Results::Create(std::string(), "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(SaveAsXMP::Results::Create(std::string(),
        "Invalid Photo object."));
    return;
  }

  // TODO(Qjia7): Check if file path exists.
  const char* file = (params->filepath).c_str();
  int size = static_cast<int>(strlen(file)) + 1;
  wchar_t* wfile = new wchar_t[size];
  mbstowcs(wfile, file, size);
  if (depthPhotoObject->GetPhoto()->SaveXMP(wfile) < PXC_STATUS_NO_ERROR) {
    info->PostResult(SaveAsXMP::Results::Create(std::string(),
        "Failed to saveXMP. Please check if file path is valid."));
  } else {
    info->PostResult(SaveAsXMP::Results::Create(std::string("Success"),
                                                std::string()));
  }
  delete wfile;
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
  double length = ep_->MeasureDistance(depthPhotoObject->GetPhoto(),
                                       start,
                                       end);

  distance.distance = length;
  info->PostResult(MeasureDistance::Results::Create(distance, std::string()));
}

void EnhancedPhotographyObject::OnDepthRefocus(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Photo photo;
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
}

void EnhancedPhotographyObject::OnDepthResize(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Photo photo;
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
}

void EnhancedPhotographyObject::OnEnhanceDepth(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Photo photo;
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
  PXCEnhancedPhotography::DepthFillQuality pxcquality;
  if (quality == DepthFillQuality::DEPTH_FILL_QUALITY_HIGH)
    pxcquality = PXCEnhancedPhotography::DepthFillQuality::HIGH;
  else
    pxcquality = PXCEnhancedPhotography::DepthFillQuality::LOW;

  PXCPhoto* pxcphoto = ep_->EnhanceDepth(depthPhotoObject->GetPhoto(),
                                         pxcquality);
  if (!pxcphoto) {
    info->PostResult(EnhanceDepth::Results::Create(photo,
        "Failed to operate EnhanceDepth"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(EnhanceDepth::Results::Create(photo, std::string()));
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

bool EnhancedPhotographyObject::CopyImage(
    PXCImage* pxcimage, jsapi::enhanced_photography::Image* img) {
  if (!pxcimage) return false;

  PXCImage::ImageInfo image_info = pxcimage->QueryInfo();
  PXCImage::ImageData image_data;
  if (pxcimage->AcquireAccess(PXCImage::ACCESS_READ,
      PXCImage::PIXEL_FORMAT_RGB32, &image_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  img->width = image_info.width;
  img->height = image_info.height;

  uint8_t* rgb32 = reinterpret_cast<uint8_t*>(image_data.planes[0]);
  for (int y = 0; y < image_info.height; y++) {
    for (int x = 0; x < image_info.width; x++) {
      int i = x * 4 + image_data.pitches[0] * y;
      img->data.push_back(rgb32[i + 2]);
      img->data.push_back(rgb32[i + 1]);
      img->data.push_back(rgb32[i]);
      img->data.push_back(rgb32[i + 3]);
    }
  }

  pxcimage->ReleaseAccess(&image_data);
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
    std::vector<std::string>::const_iterator it;
    for (it = photo_objects_.begin(); it != photo_objects_.end(); ++it) {
      DepthPhotoObject* depthPhotoObject =
        static_cast<DepthPhotoObject*>(instance_->GetBindingObjectById(*it));
      if (depthPhotoObject) {
        depthPhotoObject->DestroyPhoto();
      }
    }
    session_->Release();
    session_ = nullptr;
  }
}

}  // namespace enhanced_photography
}  // namespace realsense
