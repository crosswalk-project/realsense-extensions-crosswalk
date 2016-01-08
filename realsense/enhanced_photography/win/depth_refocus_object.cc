// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/depth_refocus_object.h"

#include <string>

#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

DepthRefocusObject::DepthRefocusObject(EnhancedPhotographyInstance* instance)
    : session_(nullptr),
      ep_(nullptr),
      instance_(instance),
      photo_(nullptr) {
  handler_.Register("init",
                    base::Bind(&DepthRefocusObject::OnInit,
                               base::Unretained(this)));
  handler_.Register("apply",
                    base::Bind(&DepthRefocusObject::OnApply,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

DepthRefocusObject::~DepthRefocusObject() {
  if (ep_) {
    ep_->Release();
    ep_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void DepthRefocusObject::OnInit(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK(ep_);
  scoped_ptr<Init::Params> params(
      Init::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(CreateStringErrorResult("Invalid Photo object."));
    return;
  }
  photo_ = depthPhotoObject->GetPhoto();

  info->PostResult(
      Init::Results::Create(std::string("Success"), std::string()));
}

void DepthRefocusObject::OnApply(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<Apply::Params> params(
      Apply::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  DCHECK(ep_);
  PXCPointI32 focus;
  focus.x = params->focus.x;
  focus.y = params->focus.y;

  PXCPhoto* pxcphoto;
  if (params->aperture)
    pxcphoto = ep_->DepthRefocus(photo_,
                                 focus,
                                 *(params->aperture.get()));
  else
    pxcphoto = ep_->DepthRefocus(photo_, focus);
  if (!pxcphoto) {
    info->PostResult(CreateStringErrorResult("Failed to operate DepthRefocus"));
    return;
  }

  jsapi::depth_photo::Photo photo;
  CreateDepthPhotoObject(instance_, pxcphoto, &photo);
  info->PostResult(Apply::Results::Create(photo, std::string()));
}

}  // namespace enhanced_photography
}  // namespace realsense
