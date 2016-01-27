// Copyright 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/common_utils.h"

#include <string>
#include "base/guid.h"
#include "base/logging.h"
#include "realsense/enhanced_photography/win/depth_photo_object.h"

namespace realsense {
namespace enhanced_photography {

bool CopyImageToBinaryMessage(PXCImage* image,
                              scoped_ptr<uint8[]>& binary_message,  // NOLINT
                              size_t* length) {
  if (!image) return false;

  PXCImage::ImageInfo img_info = image->QueryInfo();
  PXCImage::ImageData img_data;

  if (img_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_Y8) {
    if (image->AcquireAccess(PXCImage::ACCESS_READ,
        img_info.format, &img_data) < PXC_STATUS_NO_ERROR) {
      return false;
    }
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (int8 buffer, size = width * height)
    size_t requset_size = sizeof(int) * 3 + img_info.width * img_info.height;
    binary_message.reset(new uint8[requset_size]);
    *length = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message.get());
    int_array[1] = img_info.width;
    int_array[2] = img_info.height;

    uint8_t* uint8_data_array = reinterpret_cast<uint8_t*>(
        binary_message.get() + 3 * sizeof(int));
    int k = 0;
    for (int y = 0; y < img_info.height; ++y) {
      for (int x = 0; x < img_info.width; ++x) {
        uint8_t* depth8 = reinterpret_cast<uint8_t*>(
            img_data.planes[0] + img_data.pitches[0] * y);
        uint8_data_array[k++] = depth8[x];
      }
    }
  } else if (img_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_DEPTH_F32) {
    if (image->AcquireAccess(PXCImage::ACCESS_READ,
        img_info.format, &img_data) < PXC_STATUS_NO_ERROR) {
      return false;
    }
    // binary image message: call_id (i32), width (i32), height (i32),
    // mask data (float_t buffer, size = width * height *4)
    size_t requset_size =
        sizeof(int) * 3 + img_info.width * img_info.height * 4;
    binary_message.reset(new uint8[requset_size]);
    *length = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message.get());
    int_array[1] = img_info.width;
    int_array[2] = img_info.height;

    float_t* float_data_array = reinterpret_cast<float_t*>(
        binary_message.get() + 3 * sizeof(int));
    int k = 0;
    for (int y = 0; y < img_info.height; ++y) {
      for (int x = 0; x < img_info.width; ++x) {
        float_t* depth32 = reinterpret_cast<float_t*>(
            img_data.planes[0] + img_data.pitches[0] * y);
        float_data_array[k++] = depth32[x];
      }
    }
  } else if (img_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_RGB24 ||
             img_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_RGB32) {
    if (image->AcquireAccess(PXCImage::ACCESS_READ,
        PXCImage::PIXEL_FORMAT_RGB32, &img_data) < PXC_STATUS_NO_ERROR) {
      return false;
    }
    // binary image message: call_id (i32), width (i32), height (i32),
    // color (int8 buffer, size = width * height * 4)
    size_t requset_size =
        sizeof(int) * 3 + img_info.width * img_info.height * 4;
    binary_message.reset(new uint8[requset_size]);
    *length = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message.get());
    int_array[1] = img_info.width;
    int_array[2] = img_info.height;

    uint8_t* rgb32 = reinterpret_cast<uint8_t*>(img_data.planes[0]);
    uint8_t* uint8_data_array =
        reinterpret_cast<uint8_t*>(binary_message.get() + 3 * sizeof(int));
    int k = 0;
    for (int y = 0; y < img_info.height; y++) {
      for (int x = 0; x < img_info.width; x++) {
        int i = x * 4 + img_data.pitches[0] * y;
        uint8_data_array[k++] = rgb32[i + 2];
        uint8_data_array[k++] = rgb32[i + 1];
        uint8_data_array[k++] = rgb32[i];
        uint8_data_array[k++] = rgb32[i + 3];
      }
    }
  } else if (img_info.format == PXCImage::PixelFormat::PIXEL_FORMAT_DEPTH) {
    if (image->AcquireAccess(PXCImage::ACCESS_READ,
        PXCImage::PIXEL_FORMAT_DEPTH, &img_data) < PXC_STATUS_NO_ERROR) {
      return false;
    }

    // binary image message: call_id (i32), width (i32), height (i32),
    // depth (int16 buffer, size = width * height * 2)
    size_t requset_size =
        sizeof(int) * 3 + img_info.width * img_info.height * 2;
    binary_message.reset(new uint8[requset_size]);
    *length = requset_size;

    int* int_array = reinterpret_cast<int*>(binary_message.get());
    int_array[1] = img_info.width;
    int_array[2] = img_info.height;

    uint16_t* uint16_data_array = reinterpret_cast<uint16_t*>(
        binary_message.get() + 3 * sizeof(int));
    int k = 0;
    for (int y = 0; y < img_info.height; ++y) {
      for (int x = 0; x < img_info.width; ++x) {
        uint16_t* depth16 = reinterpret_cast<uint16_t*>(
            img_data.planes[0] + img_data.pitches[0] * y);
        uint16_data_array[k++] = depth16[x];
      }
    }
  } else {
    DLOG(WARNING) << "Unsupported Image Format";
    return false;
  }

  image->ReleaseAccess(&img_data);
  return true;
}

void CreateDepthPhotoObject(EnhancedPhotographyInstance* instance,
                            PXCPhoto* pxcphoto,
                            jsapi::depth_photo::Photo* photo) {
  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance);
  depthPhotoObject->SetPhoto(pxcphoto);
  scoped_ptr<xwalk::common::BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance->AddBindingObject(object_id, obj.Pass());
  photo->object_id = object_id;
}

}  // namespace enhanced_photography
}  // namespace realsense
