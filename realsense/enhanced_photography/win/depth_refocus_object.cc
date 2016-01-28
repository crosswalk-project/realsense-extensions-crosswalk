// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/depth_refocus_object.h"

#include <string>

#include "realsense/common/win/common_utils.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
using namespace realsense::common;  // NOLINT
namespace enhanced_photography {

DepthRefocusObject::DepthRefocusObject(EnhancedPhotographyInstance* instance)
    : session_(nullptr),
      instance_(instance) {
  handler_.Register("init",
                    base::Bind(&DepthRefocusObject::OnInit,
                               base::Unretained(this)));
  handler_.Register("apply",
                    base::Bind(&DepthRefocusObject::OnApply,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  depth_refocus_ = PXCEnhancedPhoto::DepthRefocus::CreateInstance(session_);
}

DepthRefocusObject::~DepthRefocusObject() {
  if (depth_refocus_) {
    depth_refocus_->Release();
    depth_refocus_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void DepthRefocusObject::OnInit(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK(depth_refocus_);
  scoped_ptr<Init::Params> params(
      Init::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PHOTO_INVALID));
    return;
  }

  if ((depth_refocus_->Init(depthPhotoObject->GetPhoto())) <
      PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "DepthRefocus Init failed"));
    return;
  }
  info->PostResult(CreateSuccessResult());
}

void DepthRefocusObject::OnApply(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<Apply::Params> params(
      Apply::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(depth_refocus_);
  PXCPointI32 focus;
  focus.x = params->focus.x;
  focus.y = params->focus.y;

  PXCPhoto* pxcphoto;
  if (params->aperture)
    pxcphoto = depth_refocus_->Apply(focus, *(params->aperture.get()));
  else
    pxcphoto = depth_refocus_->Apply(focus);
  if (!pxcphoto) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED));
    return;
  }

  jsapi::depth_photo::Photo photo;
  CreateDepthPhotoObject(instance_, pxcphoto, &photo);
  info->PostResult(Apply::Results::Create(photo, std::string()));
}

}  // namespace enhanced_photography
}  // namespace realsense
