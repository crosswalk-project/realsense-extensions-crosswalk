// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/enhanced_photography_object.h"

#include <algorithm>
#include <string>

#include "base/bind.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

EnhancedPhotographyObject::EnhancedPhotographyObject(
    EnhancedPhotographyInstance* instance)
        : session_(nullptr),
          ep_(nullptr),
          instance_(instance),
          binary_message_size_(0) {
  handler_.Register("measureDistance",
                    base::Bind(&EnhancedPhotographyObject::OnMeasureDistance,
                               base::Unretained(this)));
  handler_.Register("depthRefocus",
                    base::Bind(&EnhancedPhotographyObject::OnDepthRefocus,
                               base::Unretained(this)));
  handler_.Register("computeMaskFromCoordinate",
      base::Bind(&EnhancedPhotographyObject::OnComputeMaskFromCoordinate,
                 base::Unretained(this)));
  handler_.Register("computeMaskFromThreshold",
      base::Bind(&EnhancedPhotographyObject::OnComputeMaskFromThreshold,
                 base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

EnhancedPhotographyObject::~EnhancedPhotographyObject() {
  ReleaseResources();
}

void EnhancedPhotographyObject::OnMeasureDistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  MeasureData measure_data;
  scoped_ptr<MeasureDistance::Params> params(
      MeasureDistance::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        MeasureDistance::Results::Create(measure_data, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(MeasureDistance::Results::Create(measure_data,
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

  measure_data.distance = data.distance;
  measure_data.confidence = data.confidence;
  measure_data.precision = data.precision;
  measure_data.start_point.x = data.startPoint.coord.x;
  measure_data.start_point.y = data.startPoint.coord.y;
  measure_data.start_point.z = data.startPoint.coord.z;
  measure_data.end_point.x = data.endPoint.coord.x;
  measure_data.end_point.x = data.endPoint.coord.y;
  measure_data.end_point.x = data.endPoint.coord.z;
  info->PostResult(MeasureDistance::Results::Create(
      measure_data, std::string()));
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

  PXCPhoto* pxcphoto;
  if (params->aperture)
    pxcphoto = ep_->DepthRefocus(depthPhotoObject->GetPhoto(),
                                 focus,
                                 *(params->aperture.get()));
  else
    pxcphoto = ep_->DepthRefocus(depthPhotoObject->GetPhoto(), focus);
  if (!pxcphoto) {
    info->PostResult(DepthRefocus::Results::Create(photo,
        "Failed to operate DepthRefocus"));
    return;
  }

  CreateDepthPhotoObject(instance_, pxcphoto, &photo);
  info->PostResult(DepthRefocus::Results::Create(photo, std::string()));
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

  PXCImage* pxcimage;
  if (params->params) {
    PXCEnhancedPhoto::MaskParams mask_params;

    mask_params.frontObjectDepth = params->params->front_object_depth;
    mask_params.backOjectDepth = params->params->back_object_depth;
    mask_params.nearFallOffDepth = params->params->near_fall_off_depth;
    mask_params.farFallOffDepth = params->params->far_fall_off_depth;
    pxcimage = ep_->ComputeMaskFromCoordinate(depthPhotoObject->GetPhoto(),
                                              point,
                                              &mask_params);
  } else {
    pxcimage = ep_->ComputeMaskFromCoordinate(depthPhotoObject->GetPhoto(),
                                              point);
  }

  if (!CopyImageToBinaryMessage(pxcimage,
                                binary_message_,
                                &binary_message_size_)) {
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
  PXCImage* pxcimage;
  if (params->params) {
    PXCEnhancedPhoto::MaskParams mask_params;
    mask_params.frontObjectDepth = params->params->front_object_depth;
    mask_params.backOjectDepth = params->params->back_object_depth;
    mask_params.nearFallOffDepth = params->params->near_fall_off_depth;
    mask_params.farFallOffDepth = params->params->far_fall_off_depth;
    pxcimage = ep_->ComputeMaskFromThreshold(depthPhotoObject->GetPhoto(),
                                             params->threshold,
                                             &mask_params);
  } else {
    pxcimage = ep_->ComputeMaskFromThreshold(depthPhotoObject->GetPhoto(),
                                             params->threshold);
  }

  if (!CopyImageToBinaryMessage(pxcimage,
                                binary_message_,
                                &binary_message_size_)) {
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

void EnhancedPhotographyObject::ReleaseResources() {
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
