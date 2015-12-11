// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/photo_utils_object.h"

#include <string>

#include "base/guid.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

PhotoUtilsObject::PhotoUtilsObject(EnhancedPhotographyInstance* instance)
    : instance_(instance) {
  handler_.Register("depthResize",
                    base::Bind(&PhotoUtilsObject::OnDepthResize,
                               base::Unretained(this)));
  handler_.Register("enhanceDepth",
                    base::Bind(&PhotoUtilsObject::OnEnhanceDepth,
                               base::Unretained(this)));
  handler_.Register("photoCrop",
                    base::Bind(&PhotoUtilsObject::OnPhotoCrop,
                               base::Unretained(this)));
  handler_.Register("photoRotate",
                    base::Bind(&PhotoUtilsObject::OnPhotoRotate,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  photo_utils_ = PXCEnhancedPhoto::PhotoUtils::CreateInstance(session_);
}

PhotoUtilsObject::~PhotoUtilsObject() {
  if (photo_utils_) {
    photo_utils_->Release();
    photo_utils_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void PhotoUtilsObject::OnDepthResize(
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

  DCHECK(photo_utils_);
  int width = params->width;

  PXCPhoto* pxcphoto;
  if (params->quality) {
    PXCEnhancedPhoto::PhotoUtils::DepthFillQuality pxcquality;
    if (params->quality == DepthFillQuality::DEPTH_FILL_QUALITY_HIGH) {
      pxcquality = PXCEnhancedPhoto::PhotoUtils::DepthFillQuality::HIGH;
    } else {
      pxcquality = PXCEnhancedPhoto::PhotoUtils::DepthFillQuality::LOW;
    }
    pxcphoto = photo_utils_->DepthResize(depthPhotoObject->GetPhoto(),
                                         width,
                                         pxcquality);
  } else {
    pxcphoto = photo_utils_->DepthResize(depthPhotoObject->GetPhoto(), width);
  }

  if (!pxcphoto) {
    info->PostResult(DepthResize::Results::Create(photo,
        "Failed to operate DepthResize"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(DepthResize::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void PhotoUtilsObject::OnEnhanceDepth(
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

  DCHECK(photo_utils_);
  DepthFillQuality quality = params->quality;
  PXCEnhancedPhoto::PhotoUtils::DepthFillQuality pxcquality;
  if (quality == DepthFillQuality::DEPTH_FILL_QUALITY_HIGH)
    pxcquality = PXCEnhancedPhoto::PhotoUtils::DepthFillQuality::HIGH;
  else
    pxcquality = PXCEnhancedPhoto::PhotoUtils::DepthFillQuality::LOW;

  PXCPhoto* pxcphoto = photo_utils_->EnhanceDepth(depthPhotoObject->GetPhoto(),
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

void PhotoUtilsObject::OnPhotoCrop(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<PhotoCrop::Params> params(
      PhotoCrop::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        PhotoCrop::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(PhotoCrop::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(photo_utils_);
  PXCRectI32 pxcrect;
  pxcrect.x = params->rect.x;
  pxcrect.y = params->rect.y;
  pxcrect.w = params->rect.w;
  pxcrect.h = params->rect.h;

  PXCPhoto* pxcphoto = photo_utils_->PhotoCrop(depthPhotoObject->GetPhoto(),
                                               pxcrect);
  if (!pxcphoto) {
    info->PostResult(PhotoCrop::Results::Create(photo,
        "Failed to operate photoCrop"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(PhotoCrop::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void PhotoUtilsObject::OnPhotoRotate(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  scoped_ptr<PhotoRotate::Params> params(
      PhotoRotate::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        PhotoRotate::Results::Create(photo, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(PhotoRotate::Results::Create(photo,
        "Invalid Photo object."));
    return;
  }

  DCHECK(photo_utils_);

  pxcF32 rotation = params->rotation;
  PXCPhoto* pxcphoto = photo_utils_->PhotoRotate(depthPhotoObject->GetPhoto(),
                                                 rotation);
  if (!pxcphoto) {
    info->PostResult(PhotoRotate::Results::Create(photo,
        "Failed to operate photoRotate"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(PhotoRotate::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void PhotoUtilsObject::CreateDepthPhotoObject(
  PXCPhoto* pxcphoto, jsapi::depth_photo::Photo* photo) {
  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance_);
  depthPhotoObject->GetPhoto()->CopyPhoto(pxcphoto);
  scoped_ptr<xwalk::common::BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance_->AddBindingObject(object_id, obj.Pass());
  photo->object_id = object_id;
}

}  // namespace enhanced_photography
}  // namespace realsense
