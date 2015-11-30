// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/segmentation_object.h"

#include <vector>

#include "base/guid.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

SegmentationObject::SegmentationObject(EnhancedPhotographyInstance* instance,
                                       PXCPhoto* photo)
    : instance_(instance),
      photo_(photo),
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
  if (!photo_) {
    info->PostResult(ObjectSegment::Results::Create(
        image, "Invalid Segmentation object"));
    return;
  }

  const base::Value* image_value = NULL;
  const base::BinaryValue* binary_value = NULL;
  if (info->arguments()->Get(0, &image_value) &&
      !image_value->IsType(base::Value::TYPE_NULL)) {
    if (!image_value->IsType(base::Value::TYPE_BINARY)) {
      info->PostResult(ObjectSegment::Results::Create(
          image, "Malformed parameters"));
      return;
    } else {
      binary_value = static_cast<const base::BinaryValue*>(image_value);
    }
  } else {
    info->PostResult(ObjectSegment::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  DCHECK(segmentation_);
  const char* data = binary_value->GetBuffer();
  const int* int_array = reinterpret_cast<const int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  const char* image_data_buffer = data + 2 * sizeof(int);

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
      photo_, bounding_mask);
  if (!CopyMaskImageToBinaryMessage(pxc_mask_image)) {
    info->PostResult(ObjectSegment::Results::Create(image,
        "Failed to get image data."));
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
  if (!photo_) {
    info->PostResult(Redo::Results::Create(
        image, "Invalid Segmentation object"));
    return;
  }

  DCHECK(segmentation_);
  PXCImage* pxc_mask_image = segmentation_->Redo();
  if (!CopyMaskImageToBinaryMessage(pxc_mask_image)) {
    info->PostResult(Redo::Results::Create(image,
        "Failed to get image data."));
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
  if (!photo_) {
    info->PostResult(RefineMask::Results::Create(
        image, "Invalid Segmentation object"));
    return;
  }

  const base::Value* image_value = NULL;
  const base::BinaryValue* binary_value = NULL;
  if (info->arguments()->Get(0, &image_value) &&
    !image_value->IsType(base::Value::TYPE_NULL)) {
    if (!image_value->IsType(base::Value::TYPE_BINARY)) {
      info->PostResult(RefineMask::Results::Create(
          image, "Malformed parameters"));
      return;
    } else {
      binary_value = static_cast<const base::BinaryValue*>(image_value);
    }
  } else {
    info->PostResult(RefineMask::Results::Create(
        image, "Malformed parameters"));
    return;
  }

  DCHECK(segmentation_);

  const char* data = binary_value->GetBuffer();
  const int* int_array = reinterpret_cast<const int*>(data);
  int points_number = int_array[0];
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
  bool isForeground = bool_array[0];

  PXCImage* pxc_mask_image = segmentation_->RefineMask(
      &points[0], static_cast<pxcI32>(points.size()), isForeground);
  if (!CopyMaskImageToBinaryMessage(pxc_mask_image)) {
    info->PostResult(RefineMask::Results::Create(image,
        "Failed to get image data."));
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
  if (!photo_) {
    info->PostResult(Undo::Results::Create(
      image, "Invalid Segmentation object"));
    return;
  }

  DCHECK(segmentation_);
  PXCImage* pxc_mask_image = segmentation_->Undo();
  if (!CopyMaskImageToBinaryMessage(pxc_mask_image)) {
    info->PostResult(Redo::Results::Create(image,
        "Failed to get image data."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());

  pxc_mask_image->Release();
}

bool SegmentationObject::CopyMaskImageToBinaryMessage(PXCImage* mask) {
  if (!mask) return false;

  PXCImage::ImageInfo mask_info = mask->QueryInfo();
  PXCImage::ImageData mask_data;
  if (mask->AcquireAccess(PXCImage::ACCESS_READ,
      mask_info.format, &mask_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  if (mask_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_Y8) {
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (int8 buffer, size = width * height)
    size_t requset_size = 4 * 3 + mask_info.width * mask_info.height;
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message_.get());
    int_array[1] = mask_info.width;
    int_array[2] = mask_info.height;

    uint8_t* uint8_data_array = reinterpret_cast<uint8_t*>(
        binary_message_.get() + 3 * sizeof(int));
    int k = 0;
    for (int y = 0; y < mask_info.height; ++y) {
      for (int x = 0; x < mask_info.width; ++x) {
        uint8_t* depth8 = reinterpret_cast<uint8_t*>(
          mask_data.planes[0] + mask_data.pitches[0] * y);
        uint8_data_array[k++] = depth8[x];
      }
    }
  } else {
    DLOG(WARNING) << "Unsupported Image Format";
    return false;
  }

  mask->ReleaseAccess(&mask_data);
  return true;
}

}  // namespace enhanced_photography
}  // namespace realsense
