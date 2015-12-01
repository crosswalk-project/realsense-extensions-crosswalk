// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/enhanced_photography_object.h"

#include <algorithm>
#include <string>

#include "base/bind.h"
#include "base/guid.h"
#include "base/logging.h"
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
  handler_.Register("initMotionEffect",
                    base::Bind(&EnhancedPhotographyObject::OnInitMotionEffect,
                               base::Unretained(this)));
  handler_.Register("applyMotionEffect",
                    base::Bind(&EnhancedPhotographyObject::OnApplyMotionEffect,
                               base::Unretained(this)));
  session_ = PXCSession::CreateInstance();
  session_->CreateImpl<PXCEnhancedPhoto>(&ep_);
}

EnhancedPhotographyObject::~EnhancedPhotographyObject() {
  ReleaseResources();
}

void EnhancedPhotographyObject::CreateDepthPhotoObject(
    PXCPhoto* pxcphoto, jsapi::depth_photo::Photo* photo) {
  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance_);
  depthPhotoObject->GetPhoto()->CopyPhoto(pxcphoto);
  scoped_ptr<BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance_->AddBindingObject(object_id, obj.Pass());
  photo->object_id = object_id;
}

void EnhancedPhotographyObject::OnMeasureDistance(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  Distance distance;
  scoped_ptr<MeasureDistance::Params> params(
      MeasureDistance::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        MeasureDistance::Results::Create(distance, "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(MeasureDistance::Results::Create(distance,
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

  distance.distance = data.distance;
  info->PostResult(MeasureDistance::Results::Create(distance, std::string()));
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

  double aperture = params->aperture;

  PXCPhoto* pxcphoto = ep_->DepthRefocus(depthPhotoObject->GetPhoto(),
                                         focus,
                                         aperture);
  if (!pxcphoto) {
    info->PostResult(DepthRefocus::Results::Create(photo,
        "Failed to operate DepthRefocus"));
    return;
  }

  CreateDepthPhotoObject(pxcphoto, &photo);
  info->PostResult(DepthRefocus::Results::Create(photo, std::string()));
  pxcphoto->Release();
}

void EnhancedPhotographyObject::OnInitMotionEffect(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info) {
  scoped_ptr<InitMotionEffect::Params> params(
      InitMotionEffect::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(InitMotionEffect::Results::Create(
        std::string(), "Malformed parameters"));
    return;
  }

  std::string object_id = params->photo.object_id;
  DepthPhotoObject* depthPhotoObject = static_cast<DepthPhotoObject*>(
      instance_->GetBindingObjectById(object_id));
  if (!depthPhotoObject || !depthPhotoObject->GetPhoto()) {
    info->PostResult(InitMotionEffect::Results::Create(std::string(),
        "Invalid Photo object."));
    return;
  }

  DCHECK(ep_);
  pxcStatus sts = ep_->InitMotionEffect(depthPhotoObject->GetPhoto());
  if (sts < PXC_STATUS_NO_ERROR) {
    info->PostResult(InitMotionEffect::Results::Create(
        std::string(), "InitMotionEffect failed"));
    return;
  }

  info->PostResult(
      InitMotionEffect::Results::Create(std::string("Success"), std::string()));
}

void EnhancedPhotographyObject::OnApplyMotionEffect(
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

  if (!CopyColorImage(pxcimage)) {
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

  PXCImage* pxcimage =
      ep_->ComputeMaskFromCoordinate(depthPhotoObject->GetPhoto(), point);
  if (!CopyMaskImage(pxcimage)) {
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

  PXCImage* pxcimage = ep_->ComputeMaskFromThreshold(
      depthPhotoObject->GetPhoto(), params->threshold);
  if (!CopyMaskImage(pxcimage)) {
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

bool EnhancedPhotographyObject::CopyColorImage(PXCImage* pxcimage) {
  if (!pxcimage) return false;

  PXCImage::ImageInfo image_info = pxcimage->QueryInfo();
  PXCImage::ImageData image_data;
  if (pxcimage->AcquireAccess(PXCImage::ACCESS_READ,
      PXCImage::PIXEL_FORMAT_RGB32, &image_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  // binary image message: call_id (i32), width (i32), height (i32),
  // color (int8 buffer, size = width * height * 4)
  size_t requset_size = 4 * 3 + image_info.width * image_info.height * 4;
  if (binary_message_size_ != requset_size) {
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;
  }

  int* int_array = reinterpret_cast<int*>(binary_message_.get());
  int_array[1] = image_info.width;
  int_array[2] = image_info.height;

  uint8_t* rgb32 = reinterpret_cast<uint8_t*>(image_data.planes[0]);
  uint8_t* uint8_data_array =
      reinterpret_cast<uint8_t*>(binary_message_.get() + 3 * sizeof(int));
  int k = 0;
  for (int y = 0; y < image_info.height; y++) {
    for (int x = 0; x < image_info.width; x++) {
      int i = x * 4 + image_data.pitches[0] * y;
      uint8_data_array[k++] = rgb32[i + 2];
      uint8_data_array[k++] = rgb32[i + 1];
      uint8_data_array[k++] = rgb32[i];
      uint8_data_array[k++] = rgb32[i + 3];
    }
  }

  pxcimage->ReleaseAccess(&image_data);
  return true;
}

bool EnhancedPhotographyObject::CopyMaskImage(PXCImage* mask) {
  if (!mask) return false;

  PXCImage::ImageInfo mask_info = mask->QueryInfo();
  PXCImage::ImageData mask_data;
  if (mask->AcquireAccess(PXCImage::ACCESS_READ,
      mask_info.format, &mask_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  size_t requset_size;
  int k = 0;
  if (mask_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_Y8) {
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (int8 buffer, size = width * height)
    requset_size = 4 * 3 + mask_info.width * mask_info.height;
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message_.get());
    int_array[1] = mask_info.width;
    int_array[2] = mask_info.height;

    uint8_t* uint8_data_array = reinterpret_cast<uint8_t*>(
        binary_message_.get() + 3 * sizeof(int));
    for (int y = 0; y < mask_info.height; ++y) {
      for (int x = 0; x < mask_info.width; ++x) {
        uint8_t* depth8 = reinterpret_cast<uint8_t*>(
            mask_data.planes[0] + mask_data.pitches[0] * y);
        uint8_data_array[k++] = depth8[x];
      }
    }
  } else if (mask_info.format ==
      PXCImage::PixelFormat::PIXEL_FORMAT_DEPTH_F32) {
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (float_t buffer, size = width * height *4)
    requset_size = 3 * 4 + mask_info.width * mask_info.height * 4;
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message_.get());
    int_array[1] = mask_info.width;
    int_array[2] = mask_info.height;

    float_t* float_data_array = reinterpret_cast<float_t*>(
        binary_message_.get() + 3 * sizeof(int));
    for (int y = 0; y < mask_info.height; ++y) {
      for (int x = 0; x < mask_info.width; ++x) {
        float_t* depth32 = reinterpret_cast<float_t*>(
            mask_data.planes[0] + mask_data.pitches[0] * y);
        float_data_array[k++] = depth32[x];
      }
    }
  }

  mask->ReleaseAccess(&mask_data);
  return true;
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
