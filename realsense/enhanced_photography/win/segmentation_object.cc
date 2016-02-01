// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/segmentation_object.h"

#include <string>
#include <vector>

#include "realsense/common/win/common_utils.h"
#include "realsense/enhanced_photography/win/common_utils.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
using namespace realsense::common;  // NOLINT
namespace enhanced_photography {

SegmentationObject::SegmentationObject(EnhancedPhotographyInstance* instance)
    : instance_(instance),
      binary_message_size_(0) {
  handler_.Register("objectSegment",
      base::Bind(&SegmentationObject::OnObjectSegment,
                 base::Unretained(this)));
  handler_.Register("redo",
      base::Bind(&SegmentationObject::OnRedo,
                 base::Unretained(this)));
  handler_.Register("refineMask",
      base::Bind(&SegmentationObject::OnRefineMask,
                 base::Unretained(this)));
  handler_.Register("undo",
      base::Bind(&SegmentationObject::OnUndo,
                 base::Unretained(this)));

  session_ = PXCSession::CreateInstance();
  segmentation_ = PXCEnhancedPhoto::Segmentation::CreateInstance(session_);
}

SegmentationObject::~SegmentationObject() {
  if (segmentation_) {
    segmentation_->Release();
    segmentation_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void SegmentationObject::OnObjectSegment(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;

  const base::Value* image_value = NULL;
  const base::BinaryValue* binary_value = NULL;
  if (info->arguments()->Get(0, &image_value) &&
      !image_value->IsType(base::Value::TYPE_NULL)) {
    if (!image_value->IsType(base::Value::TYPE_BINARY)) {
      info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
      return;
    } else {
      binary_value = static_cast<const base::BinaryValue*>(image_value);
    }
  } else {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(segmentation_);
  const char* data = binary_value->GetBuffer();
  int offset = 0;
  const int* int_array = reinterpret_cast<const int*>(data);
  int object_id_len = int_array[0];
  int aligned_object_id_len = object_id_len + 4 - object_id_len % 4;
  offset += sizeof(int);

  std::string object_id(data + offset, object_id_len);
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PHOTO_INVALID));
    return;
  }

  offset += aligned_object_id_len;
  int_array = reinterpret_cast<const int*>(data + offset);
  int width = int_array[0];
  int height = int_array[1];
  offset += 2 * sizeof(int);

  const char* image_data_buffer = data + offset;

  PXCImage::ImageInfo img_info;
  PXCImage::ImageData img_data;
  memset(&img_info, 0, sizeof(img_info));
  memset(&img_data, 0, sizeof(img_data));

  img_info.width = width;
  img_info.height = height;
  img_info.format = PXCImage::PIXEL_FORMAT_Y8;

  int bufSize = img_info.width * img_info.height;
  img_data.planes[0] = new BYTE[bufSize];
  img_data.pitches[0] = img_info.width;
  img_data.format = img_info.format;

  for (int y = 0; y < img_info.height; y++) {
    for (int x = 0; x < img_info.width; x++) {
      int i = x + img_data.pitches[0] * y;
      img_data.planes[0][i] = image_data_buffer[i];
    }
  }

  PXCImage* bounding_mask = session_->CreateImage(&img_info, &img_data);

  PXCImage* pxc_mask_image = segmentation_->ObjectSegment(
      depthPhotoObject->GetPhoto(), bounding_mask);
  if (!CopyImageToBinaryMessage(pxc_mask_image,
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

  bounding_mask->Release();
  pxc_mask_image->Release();
  delete img_data.planes[0];
}

void SegmentationObject::OnRedo(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;

  DCHECK(segmentation_);
  PXCImage* pxc_mask_image = segmentation_->Redo();
  if (!CopyImageToBinaryMessage(pxc_mask_image,
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

  pxc_mask_image->Release();
}

void SegmentationObject::OnRefineMask(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;

  const base::Value* image_value = NULL;
  const base::BinaryValue* binary_value = NULL;
  if (info->arguments()->Get(0, &image_value) &&
    !image_value->IsType(base::Value::TYPE_NULL)) {
    if (!image_value->IsType(base::Value::TYPE_BINARY)) {
      info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
      return;
    } else {
      binary_value = static_cast<const base::BinaryValue*>(image_value);
    }
  } else {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }

  DCHECK(segmentation_);

  const char* data = binary_value->GetBuffer();
  const int* int_array = reinterpret_cast<const int*>(data);
  int points_number = int_array[0];
  if (points_number == 0) {
    info->PostResult(CreateErrorResult(ERROR_CODE_PARAM_UNSUPPORTED));
    return;
  }
  std::vector<PXCPointI32> points;
  int k = 1;
  for (int i = 0; i < points_number; i++) {
    PXCPointI32 pt;
    pt.x = int_array[k];
    k++;
    pt.y = int_array[k];
    k++;
    points.push_back(pt);
  }

  int offset = (1 + points_number * 2) * sizeof(int);
  const uint8_t* bool_array = reinterpret_cast<
      const uint8_t*>(data + offset);
  bool isForeground = bool_array[0] != 0;

  PXCImage* pxc_mask_image = segmentation_->RefineMask(
      &points[0], static_cast<pxcI32>(points.size()), isForeground);
  if (!CopyImageToBinaryMessage(pxc_mask_image,
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

  pxc_mask_image->Release();
}

void SegmentationObject::OnUndo(scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image image;

  DCHECK(segmentation_);
  PXCImage* pxc_mask_image = segmentation_->Undo();
  if (!CopyImageToBinaryMessage(pxc_mask_image,
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

  pxc_mask_image->Release();
}

}  // namespace enhanced_photography
}  // namespace realsense
