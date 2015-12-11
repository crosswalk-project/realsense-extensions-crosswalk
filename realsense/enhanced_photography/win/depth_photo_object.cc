// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/depth_photo_object.h"

#include <string>
#include <vector>

#include "base/bind.h"
#include "base/guid.h"

namespace realsense {
namespace enhanced_photography {

DepthPhotoObject::DepthPhotoObject(EnhancedPhotographyInstance* instance)
    : instance_(instance),
      binary_message_size_(0) {
  handler_.Register("queryContainerImage",
                    base::Bind(&DepthPhotoObject::OnQueryContainerImage,
                               base::Unretained(this)));
  handler_.Register("queryColorImage",
                    base::Bind(&DepthPhotoObject::OnQueryColorImage,
                               base::Unretained(this)));
  handler_.Register("queryDepthImage",
                    base::Bind(&DepthPhotoObject::OnQueryDepthImage,
                               base::Unretained(this)));
  handler_.Register("queryRawDepthImage",
                    base::Bind(&DepthPhotoObject::OnQueryRawDepthImage,
                               base::Unretained(this)));
  handler_.Register("setContainerImage",
                    base::Bind(&DepthPhotoObject::OnSetContainerImage,
                               base::Unretained(this)));
  handler_.Register("setColorImage",
                    base::Bind(&DepthPhotoObject::OnSetColorImage,
                               base::Unretained(this)));
  handler_.Register("setDepthImage",
                    base::Bind(&DepthPhotoObject::OnSetDepthImage,
                               base::Unretained(this)));
  handler_.Register("setRawDepthImage",
                    base::Bind(&DepthPhotoObject::OnSetRawDepthImage,
                               base::Unretained(this)));
  handler_.Register("clone",
                    base::Bind(&DepthPhotoObject::OnClone,
                               base::Unretained(this)));
  session_ = PXCSession::CreateInstance();
  photo_ = session_->CreatePhoto();
}

DepthPhotoObject::~DepthPhotoObject() {
  DestroyPhoto();
}

void DepthPhotoObject::DestroyPhoto() {
  if (photo_) {
    photo_->Release();
    photo_ = nullptr;
  }
  if (session_) {
    session_->Release();
    session_ = nullptr;
  }
}

void DepthPhotoObject::OnQueryContainerImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  if (!photo_) {
    info->PostResult(QueryContainerImage::Results::Create(img,
        "Invalid photo object"));
    return;
  }

  PXCImage* imColor = photo_->QueryContainerImage();
  if (!CopyColorImage(imColor)) {
    info->PostResult(QueryContainerImage::Results::Create(img,
        "Failed to QueryContainerImage."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
}

void DepthPhotoObject::OnQueryColorImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  if (!photo_) {
    info->PostResult(QueryColorImage::Results::Create(img,
        "Invalid photo object"));
    return;
  }

  PXCImage* imColor = photo_->QueryColorImage();
  if (!CopyColorImage(imColor)) {
    info->PostResult(QueryColorImage::Results::Create(img,
        "Failed to QueryColorImage."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
}

void DepthPhotoObject::OnQueryDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  if (!photo_) {
    info->PostResult(QueryDepthImage::Results::Create(img,
        "Invalid photo object."));
    return;
  }

  PXCImage* imDepth = photo_->QueryDepthImage();
  if (!CopyDepthImage(imDepth)) {
    info->PostResult(QueryDepthImage::Results::Create(img,
        "Failed to QueryDepthImage."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
}

void DepthPhotoObject::OnQueryRawDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Image img;
  if (!photo_) {
    info->PostResult(QueryRawDepthImage::Results::Create(img,
        "Invalid photo object."));
    return;
  }

  PXCImage* imDepth = photo_->QueryRawDepthImage();
  if (!CopyDepthImage(imDepth)) {
    info->PostResult(QueryRawDepthImage::Results::Create(img,
        "Failed to QueryRawDepthImage."));
    return;
  }

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::BinaryValue::CreateWithCopiedBuffer(
      reinterpret_cast<const char*>(binary_message_.get()),
      binary_message_size_));
  info->PostResult(result.Pass());
}

void DepthPhotoObject::OnSetContainerImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(SetContainerImage::Results::Create(std::string(),
        "Invalid photo object"));
    return;
  }

  scoped_ptr<SetContainerImage::Params> params(
      SetContainerImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetContainerImage::
        Results::Create(std::string(), "Malformed parameters"));
    return;
  }

  std::vector<char> buffer = params->image;
  char* data = &buffer[0];
  int* int_array = reinterpret_cast<int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  char* image_data = data + 2 * sizeof(int);

  PXCImage* out = photo_->QueryContainerImage();
  if (!out) {
    info->PostResult(SetContainerImage::Results::Create(std::string(),
        "The photo image is uninitialized."));
    return;
  }
  PXCImage::ImageInfo outInfo = out->QueryInfo();
  if (width != outInfo.width || height != outInfo.height) {
    info->PostResult(SetContainerImage::Results::Create(std::string(),
        "Wrong image width and height"));
    return;
  }

  PXCImage::ImageData outData;
  pxcStatus photoSts = out->AcquireAccess(PXCImage::ACCESS_READ_WRITE,
                                          PXCImage::PIXEL_FORMAT_RGB32,
                                          &outData);
  if (photoSts != PXC_STATUS_NO_ERROR) {
    info->PostResult(SetContainerImage::Results::Create(std::string(),
        "Failed to get color data"));
    return;
  }

  for (int y = 0; y < outInfo.height; y++) {
    for (int x = 0; x < outInfo.width; x++) {
      int i = x * 4 + outData.pitches[0] * y;
      outData.planes[0][i] = image_data[i + 2];
      outData.planes[0][i + 1] = image_data[i + 1];
      outData.planes[0][i + 2] = image_data[i];
      outData.planes[0][i + 3] = image_data[i + 3];
    }
  }
  out->ReleaseAccess(&outData);

  info->PostResult(SetContainerImage::Results::Create(
      std::string("Success"), std::string()));
}

void DepthPhotoObject::OnSetColorImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(SetColorImage::Results::Create(std::string(),
        "Invalid photo object"));
    return;
  }

  scoped_ptr<SetColorImage::Params> params(
      SetColorImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetColorImage::
        Results::Create(std::string(), "Malformed parameters"));
    return;
  }

  std::vector<char> buffer = params->image;
  char* data = &buffer[0];
  int* int_array = reinterpret_cast<int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  char* image_data = data + 2 * sizeof(int);

  PXCImage* out = photo_->QueryColorImage();
  if (!out) {
    info->PostResult(SetColorImage::Results::Create(std::string(),
        "The photo image is uninitialized."));
    return;
  }
  PXCImage::ImageInfo outInfo = out->QueryInfo();
  if (width != outInfo.width || height != outInfo.height) {
    info->PostResult(SetColorImage::Results::Create(std::string(),
        "Wrong image width and height"));
    return;
  }

  PXCImage::ImageData outData;
  pxcStatus photoSts = out->AcquireAccess(PXCImage::ACCESS_READ_WRITE,
                                          PXCImage::PIXEL_FORMAT_RGB32,
                                          &outData);
  if (photoSts != PXC_STATUS_NO_ERROR) {
    info->PostResult(SetColorImage::Results::Create(std::string(),
        "Failed to get color data"));
    return;
  }

  for (int y = 0; y < outInfo.height; y++) {
    for (int x = 0; x < outInfo.width; x++) {
      int i = x * 4 + outData.pitches[0] * y;
      outData.planes[0][i] = image_data[i + 2];
      outData.planes[0][i + 1] = image_data[i + 1];
      outData.planes[0][i + 2] = image_data[i];
      outData.planes[0][i + 3] = image_data[i + 3];
    }
  }
  out->ReleaseAccess(&outData);

  info->PostResult(SetColorImage::Results::Create(
      std::string("Success"), std::string()));
}

void DepthPhotoObject::OnSetDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(SetDepthImage::Results::Create(std::string(),
        "Invalid photo object"));
    return;
  }

  scoped_ptr<SetDepthImage::Params> params(
      SetDepthImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(
        SetDepthImage::Results::Create(std::string(), "Malformed parameters"));
    return;
  }

  std::vector<char> buffer = params->image;
  char* data = &buffer[0];
  int* int_array = reinterpret_cast<int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  char* image_data = data + 2 * sizeof(int);

  PXCImage* out = photo_->QueryDepthImage();
  PXCImage::ImageInfo outInfo = out->QueryInfo();
  if (width != outInfo.width || height != outInfo.height) {
    info->PostResult(SetDepthImage::Results::Create(std::string(),
        "Wrong image width and height"));
    return;
  }

  PXCImage::ImageData outData;
  pxcStatus photoSts = out->AcquireAccess(PXCImage::ACCESS_READ_WRITE,
                                          PXCImage::PIXEL_FORMAT_DEPTH,
                                          &outData);
  if (photoSts != PXC_STATUS_NO_ERROR) {
    info->PostResult(SetDepthImage::Results::Create(std::string(),
        "Failed to get depth data"));
    return;
  }

  int i = 0;
  for (int y = 0; y < outInfo.height; ++y) {
    for (int x = 0; x < outInfo.width; ++x) {
      uint16_t* depth16 = reinterpret_cast<uint16_t*>(
        outData.planes[0] + outData.pitches[0] * y);
      depth16[x] = image_data[i];
      i++;
    }
  }
  out->ReleaseAccess(&outData);

  info->PostResult(SetDepthImage::Results::Create(std::string("Success"),
                                                  std::string()));
}

void DepthPhotoObject::OnSetRawDepthImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(SetRawDepthImage::Results::Create(std::string(),
        "Invalid photo object"));
    return;
  }

  scoped_ptr<SetRawDepthImage::Params> params(
      SetRawDepthImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(SetRawDepthImage::Results::Create(
        std::string(), "Malformed parameters"));
    return;
  }

  std::vector<char> buffer = params->image;
  char* data = &buffer[0];
  int* int_array = reinterpret_cast<int*>(data);
  int width = int_array[0];
  int height = int_array[1];
  char* image_data = data + 2 * sizeof(int);

  PXCImage* out = photo_->QueryRawDepthImage();
  PXCImage::ImageInfo outInfo = out->QueryInfo();
  if (width != outInfo.width || height != outInfo.height) {
    info->PostResult(SetRawDepthImage::Results::Create(std::string(),
        "Wrong image width and height"));
    return;
  }

  PXCImage::ImageData outData;
  pxcStatus photoSts = out->AcquireAccess(PXCImage::ACCESS_READ_WRITE,
                                          PXCImage::PIXEL_FORMAT_DEPTH,
                                          &outData);
  if (photoSts != PXC_STATUS_NO_ERROR) {
    info->PostResult(SetRawDepthImage::Results::Create(std::string(),
        "Failed to get depth data"));
    return;
  }

  int i = 0;
  for (int y = 0; y < outInfo.height; ++y) {
    for (int x = 0; x < outInfo.width; ++x) {
      uint16_t* depth16 = reinterpret_cast<uint16_t*>(
          outData.planes[0] + outData.pitches[0] * y);
      depth16[x] = image_data[i];
      i++;
    }
  }
  out->ReleaseAccess(&outData);

  info->PostResult(SetRawDepthImage::Results::Create(
      std::string("Success"), std::string()));
}

void DepthPhotoObject::OnClone(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  jsapi::depth_photo::Photo photo;
  if (!photo_) {
    info->PostResult(Clone::Results::Create(photo,
        "Invalid photo object"));
    return;
  }

  DepthPhotoObject* depthPhotoObject = new DepthPhotoObject(instance_);
  depthPhotoObject->GetPhoto()->CopyPhoto(photo_);
  scoped_ptr<BindingObject> obj(depthPhotoObject);
  std::string object_id = base::GenerateGUID();
  instance_->AddBindingObject(object_id, obj.Pass());
  photo.object_id = object_id;
  info->PostResult(Clone::Results::Create(photo, std::string()));
}

bool DepthPhotoObject::CopyColorImage(PXCImage* pxcimage) {
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

bool DepthPhotoObject::CopyDepthImage(PXCImage* depth) {
  if (!depth) return false;

  PXCImage::ImageInfo depth_info = depth->QueryInfo();
  PXCImage::ImageData depth_data;
  if (depth->AcquireAccess(PXCImage::ACCESS_READ,
      PXCImage::PIXEL_FORMAT_DEPTH, &depth_data) < PXC_STATUS_NO_ERROR) {
    return false;
  }

  // binary image message: call_id (i32), width (i32), height (i32),
  // depth (int16 buffer, size = width * height * 2)
  size_t requset_size = 4 * 3 + depth_info.width * depth_info.height * 2;
  if (binary_message_size_ != requset_size) {
    binary_message_.reset(new uint8[requset_size]);
    binary_message_size_ = requset_size;
  }

  int* int_array = reinterpret_cast<int*>(binary_message_.get());
  int_array[1] = depth_info.width;
  int_array[2] = depth_info.height;

  uint16_t* uint16_data_array = reinterpret_cast<uint16_t*>(
      binary_message_.get() + 3 * sizeof(int));
  int k = 0;
  for (int y = 0; y < depth_info.height; ++y) {
    for (int x = 0; x < depth_info.width; ++x) {
      uint16_t* depth16 = reinterpret_cast<uint16_t*>(
          depth_data.planes[0] + depth_data.pitches[0] * y);
      uint16_data_array[k++] = depth16[x];
    }
  }
  depth->ReleaseAccess(&depth_data);
  return true;
}

}  // namespace enhanced_photography
}  // namespace realsense
