// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/measurement_object.h"

#include <string>

#include "base/bind.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

MeasurementObject::MeasurementObject(
    EnhancedPhotographyInstance* instance)
        : session_(nullptr),
          ep_(nullptr),
          instance_(instance) {
  handler_.Register("measureDistance",
                    base::Bind(&MeasurementObject::OnMeasureDistance,
                               base::Unretained(this)));
  handler_.Register("measureUADistance",
                    base::Bind(&MeasurementObject::OnMeasureUADistance,
                               base::Unretained(this)));
  handler_.Register("queryUADataSize",
                    base::Bind(&MeasurementObject::OnQueryUADataSize,
                               base::Unretained(this)));
  handler_.Register("queryUAData",
                    base::Bind(&MeasurementObject::OnQueryUAData,
                               base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

MeasurementObject::~MeasurementObject() {
  ReleaseResources();
}

void MeasurementObject::OnMeasureDistance(
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

void MeasurementObject::OnMeasureUADistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  NOTIMPLEMENTED();
  info->PostResult(CreateStringErrorResult("not-implemented"));
}

void MeasurementObject::OnQueryUADataSize(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  NOTIMPLEMENTED();
  info->PostResult(CreateStringErrorResult("not-implemented"));
}

void MeasurementObject::OnQueryUAData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  NOTIMPLEMENTED();
  info->PostResult(CreateStringErrorResult("not-implemented"));
}

void MeasurementObject::ReleaseResources() {
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
