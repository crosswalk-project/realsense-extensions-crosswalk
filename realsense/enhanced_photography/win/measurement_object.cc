// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/measurement_object.h"

#include <string>

#include "base/bind.h"
#include "realsense/common/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
using namespace realsense::common;  // NOLINT
namespace enhanced_photography {

MeasurementObject::MeasurementObject(
    EnhancedPhotographyInstance* instance)
        : session_(nullptr),
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
  measurement_ = PXCEnhancedPhoto::Measurement::CreateInstance(session_);
}

MeasurementObject::~MeasurementObject() {
  ReleaseResources();
}

void MeasurementObject::OnMeasureDistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<MeasureDistance::Params> params(
      MeasureDistance::Params::Create(*info->arguments()));
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

  DCHECK(measurement_);
  PXCPointI32 start = { params->start.x, params->start.y };
  PXCPointI32 end = { params->end.x, params->end.y };
  PXCEnhancedPhoto::Measurement::MeasureData data;
  pxcStatus status = measurement_->MeasureDistance(depthPhotoObject->GetPhoto(),
                                                   start,
                                                   end,
                                                   &data);
  if (status != PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "MeasureDistance failed"));
    return;
  }

  MeasureData measure_data;
  FillMeasureData(&measure_data, &data);
  info->PostResult(MeasureDistance::Results::Create(
      measure_data, std::string()));
}

void MeasurementObject::OnMeasureUADistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<MeasureUADistance::Params> params(
      MeasureUADistance::Params::Create(*info->arguments()));
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

  DCHECK(measurement_);
  PXCPointI32 start = { params->start.x, params->start.y };
  PXCPointI32 end = { params->end.x, params->end.y };
  PXCEnhancedPhoto::Measurement::MeasureData data;
  pxcStatus status = measurement_->MeasureUADistance(
      depthPhotoObject->GetPhoto(), start, end, &data);
  if (status != PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "MeasureUADistance failed"));
    return;
  }

  MeasureData measure_data;
  FillMeasureData(&measure_data, &data);
  info->PostResult(MeasureUADistance::Results::Create(
      measure_data, std::string()));
}

void MeasurementObject::OnQueryUADataSize(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK(measurement_);
  pxcI32 size = measurement_->QueryUADataSize();
  info->PostResult(QueryUADataSize::Results::Create(
      size, std::string()));
}

void MeasurementObject::OnQueryUAData(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK(measurement_);
  PXCEnhancedPhoto::Measurement::MeasureData data;
  pxcStatus status = measurement_->QueryUAData(&data);
  if (status != PXC_STATUS_NO_ERROR) {
    info->PostResult(CreateErrorResult(ERROR_CODE_EXEC_FAILED,
                                       "QueryUAData failed"));
    return;
  }

  MeasureData measure_data;
  FillMeasureData(&measure_data, &data);
  info->PostResult(QueryUAData::Results::Create(
      measure_data, std::string()));
}

void MeasurementObject::FillMeasureData(
    MeasureData* measureData,
    PXCEnhancedPhoto::Measurement::MeasureData* data) {
  measureData->distance = data->distance;
  measureData->confidence = data->confidence;
  measureData->precision = data->precision;
  measureData->start_point.x = data->startPoint.coord.x;
  measureData->start_point.y = data->startPoint.coord.y;
  measureData->start_point.z = data->startPoint.coord.z;
  measureData->start_point.confidence = data->startPoint.confidence;
  measureData->start_point.precision = data->startPoint.precision;
  measureData->end_point.x = data->endPoint.coord.x;
  measureData->end_point.y = data->endPoint.coord.y;
  measureData->end_point.z = data->endPoint.coord.z;
  measureData->end_point.confidence = data->endPoint.confidence;
  measureData->end_point.precision = data->endPoint.precision;
}

void MeasurementObject::ReleaseResources() {
  if (measurement_) {
    measurement_->Release();
    measurement_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

}  // namespace enhanced_photography
}  // namespace realsense
