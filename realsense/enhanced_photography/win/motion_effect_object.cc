// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/motion_effect_object.h"

namespace realsense {
namespace enhanced_photography {

MotionEffectObject::MotionEffectObject(EnhancedPhotographyInstance* instance,
                                       PXCPhoto* photo)
    : session_(nullptr),
      ep_(nullptr),
      instance_(instance),
      photo_(photo),
      binary_message_size_(0) {
  handler_.Register("initMotionEffect",
                    base::Bind(&MotionEffectObject::OnInitMotionEffect,
                               base::Unretained(this)));
  handler_.Register("applyMotionEffect",
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
  pxcStatus sts = ep_->InitMotionEffect(photo_);
  if (sts < PXC_STATUS_NO_ERROR) {
    info->PostResult(InitMotionEffect::Results::Create(
        std::string(), "InitMotionEffect failed"));
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

  if (!CopyColorImageToBinaryMessage(pxcimage)) {
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

bool MotionEffectObject::CopyColorImageToBinaryMessage(PXCImage* pxcimage) {
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
  binary_message_.reset(new uint8[requset_size]);
  binary_message_size_ = requset_size;

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

}  // namespace enhanced_photography
}  // namespace realsense
