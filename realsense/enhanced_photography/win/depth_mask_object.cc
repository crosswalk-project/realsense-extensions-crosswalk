// Copyright 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/depth_mask_object.h"

#include <string>

#include "realsense/common/win/common_utils.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
using namespace realsense::common;  // NOLINT
namespace enhanced_photography {

DepthMaskObject::DepthMaskObject(EnhancedPhotographyInstance* instance)
    : session_(nullptr),
      instance_(instance),
      binary_message_size_(0) {
  handler_.Register("init",
                    base::Bind(&DepthMaskObject::OnInit,
                               base::Unretained(this)));
  handler_.Register("computeFromCoordinate",
      base::Bind(&DepthMaskObject::OnComputeFromCoordinate,
                 base::Unretained(this)));
  handler_.Register("computeFromThreshold",
      base::Bind(&DepthMaskObject::OnComputeFromThreshold,
                 base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  depth_mask_ = PXCEnhancedPhoto::DepthMask::CreateInstance(session_);
}

DepthMaskObject::~DepthMaskObject() {
  if (depth_mask_) {
    depth_mask_->Release();
    depth_mask_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void DepthMaskObject::OnInit(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK(depth_mask_);
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
  if ((depth_mask_->Init(depthPhotoObject->GetPhoto())) < PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "DepthMask Init failed."));
    return;
  }

  info->PostResult(CreateSuccessResult());
}

void DepthMaskObject::OnComputeFromCoordinate(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<ComputeFromCoordinate::Params> params(
      ComputeFromCoordinate::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(depth_mask_);
  PXCPointI32 point;
  point.x = params->point.x;
  point.y = params->point.y;

  PXCImage* pxcimage;
  if (params->params) {
    PXCEnhancedPhoto::DepthMask::MaskParams mask_params;

    mask_params.frontObjectDepth = params->params->front_object_depth;
    mask_params.backOjectDepth = params->params->back_object_depth;
    mask_params.nearFallOffDepth = params->params->near_fall_off_depth;
    mask_params.farFallOffDepth = params->params->far_fall_off_depth;
    pxcimage = depth_mask_->ComputeFromCoordinate(point, &mask_params);
  } else {
    pxcimage = depth_mask_->ComputeFromCoordinate(point);
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

void DepthMaskObject::OnComputeFromThreshold(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<ComputeFromThreshold::Params> params(
      ComputeFromThreshold::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(depth_mask_);
  PXCImage* pxcimage;
  if (params->params) {
    PXCEnhancedPhoto::DepthMask::MaskParams mask_params;
    mask_params.frontObjectDepth = params->params->front_object_depth;
    mask_params.backOjectDepth = params->params->back_object_depth;
    mask_params.nearFallOffDepth = params->params->near_fall_off_depth;
    mask_params.farFallOffDepth = params->params->far_fall_off_depth;
    pxcimage = depth_mask_->ComputeFromThreshold(params->threshold,
                                                 &mask_params);
  } else {
    pxcimage = depth_mask_->ComputeFromThreshold(params->threshold);
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
