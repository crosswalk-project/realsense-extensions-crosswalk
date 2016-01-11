// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/motion_effect_object.h"

#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

MotionEffectObject::MotionEffectObject(EnhancedPhotographyInstance* instance)
    : session_(nullptr),
      ep_(nullptr),
      instance_(instance),
      binary_message_size_(0) {
  handler_.Register("init",
                    base::Bind(&MotionEffectObject::OnInitMotionEffect,
                               base::Unretained(this)));
  handler_.Register("apply",
                    base::Bind(&MotionEffectObject::OnApplyMotionEffect,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

MotionEffectObject::~MotionEffectObject() {
  if (ep_) {
    ep_->Release();
    ep_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void MotionEffectObject::OnInitMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  DCHECK(ep_);

  scoped_ptr<InitMotionEffect::Params> params(
      InitMotionEffect::Params::Create(*info->arguments()));
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

  pxcStatus sts = ep_->InitMotionEffect(depthPhotoObject->GetPhoto());
  if (sts < PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateStringErrorResult("InitMotionEffect failed"));
    return;
  }

  info->PostResult(
      InitMotionEffect::Results::Create(std::string("Success"), std::string()));
}

void MotionEffectObject::OnApplyMotionEffect(
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

  if (!CopyImageToBinaryMessage(pxcimage,
                                binary_message_,
                                &binary_message_size_)) {
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

}  // namespace enhanced_photography
}  // namespace realsense
