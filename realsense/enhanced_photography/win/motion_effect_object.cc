// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/motion_effect_object.h"

#include "realsense/common/win/common_utils.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
using namespace realsense::common;  // NOLINT
namespace enhanced_photography {

MotionEffectObject::MotionEffectObject(EnhancedPhotographyInstance* instance)
    : session_(nullptr),
      instance_(instance),
      binary_message_size_(0) {
  handler_.Register("init",
                    base::Bind(&MotionEffectObject::OnInitMotionEffect,
                               base::Unretained(this)));
  handler_.Register("apply",
                    base::Bind(&MotionEffectObject::OnApplyMotionEffect,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  motion_effect_ = PXCEnhancedPhoto::MotionEffect::CreateInstance(session_);
}

MotionEffectObject::~MotionEffectObject() {
  if (motion_effect_) {
    motion_effect_->Release();
    motion_effect_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void MotionEffectObject::OnInitMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  DCHECK(motion_effect_);

  scoped_ptr<InitMotionEffect::Params> params(
      InitMotionEffect::Params::Create(*info->arguments()));
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

  pxcStatus sts = motion_effect_->Init(depthPhotoObject->GetPhoto());
  if (sts < PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED));
    return;
  }

  info->PostResult(CreateSuccessResult());
}

void MotionEffectObject::OnApplyMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  scoped_ptr<ApplyMotionEffect::Params> params(
      ApplyMotionEffect::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(motion_effect_);
  pxcF32 motion[3];
  motion[0] = params->motion.horizontal;
  motion[1] = params->motion.vertical;
  motion[2] = params->motion.distance;

  pxcF32 rotation[3];
  rotation[0] = params->rotation.pitch;
  rotation[1] = params->rotation.yaw;
  rotation[2] = params->rotation.roll;

  PXCImage* pxcimage = motion_effect_->Apply(motion, rotation, params->zoom);

  if (!pxcimage) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED));
    return;
  }

  if (!CopyImageToBinaryMessage(pxcimage,
                                binary_message_,
                                &binary_message_size_)) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxcimage->Release();
}

}  // namespace enhanced_photography
}  // namespace realsense
