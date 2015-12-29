// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/win/depth_photo_object.h"

#include <string>
#include <vector>

#include "base/bind.h"
#include "base/guid.h"
#include "base/strings/sys_string_conversions.h"
#include "realsense/enhanced_photography/win/common_utils.h"

namespace realsense {
namespace enhanced_photography {

DepthPhotoObject::DepthPhotoObject(EnhancedPhotographyInstance* instance)
    : instance_(instance),
      binary_message_size_(0) {
  handler_.Register("checkSignature",
                    base::Bind(&DepthPhotoObject::OnCheckSignature,
                               base::Unretained(this)));
  handler_.Register("queryCameraPerspectiveModel",
                    base::Bind(&DepthPhotoObject::OnQueryCameraPerspectiveModel,
                               base::Unretained(this)));
  handler_.Register("queryCameraPose",
                    base::Bind(&DepthPhotoObject::OnQueryCameraPose,
                               base::Unretained(this)));
  handler_.Register("queryCameraVendorInfo",
                    base::Bind(&DepthPhotoObject::OnQueryCameraVendorInfo,
                               base::Unretained(this)));
  handler_.Register("queryContainerImage",
                    base::Bind(&DepthPhotoObject::OnQueryContainerImage,
                               base::Unretained(this)));
  handler_.Register("queryColorImage",
                    base::Bind(&DepthPhotoObject::OnQueryColorImage,
                               base::Unretained(this)));
  handler_.Register("queryDepthImage",
                    base::Bind(&DepthPhotoObject::OnQueryDepthImage,
                               base::Unretained(this)));
  handler_.Register("queryDeviceVendorInfo",
                    base::Bind(&DepthPhotoObject::OnQueryDeviceVendorInfo,
                               base::Unretained(this)));
  handler_.Register("queryNumberOfCameras",
                    base::Bind(&DepthPhotoObject::OnQueryNumberOfCameras,
                               base::Unretained(this)));
  handler_.Register("queryRawDepthImage",
                    base::Bind(&DepthPhotoObject::OnQueryRawDepthImage,
                               base::Unretained(this)));
  handler_.Register("queryXDMRevision",
                    base::Bind(&DepthPhotoObject::OnQueryXDMRevision,
                               base::Unretained(this)));
  handler_.Register("resetContainerImage",
                    base::Bind(&DepthPhotoObject::OnResetContainerImage,
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

void DepthPhotoObject::OnCheckSignature(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  pxcBool result = photo_->CheckSignature();
  info->PostResult(CheckSignature::Results::Create(result, std::string()));
}

void DepthPhotoObject::OnQueryCameraPerspectiveModel(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  scoped_ptr<QueryCameraPerspectiveModel::Params> params(
      QueryCameraPerspectiveModel::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  PXCPhoto::PerspectiveCameraModel model;
  photo_->QueryCameraPerspectiveModel(params->camera_index, model);
  PerspectiveCameraModel camera_model;
  camera_model.model = base::SysWideToUTF8(model.model);
  camera_model.focal_length.x = model.focalLength.x;
  camera_model.focal_length.y = model.focalLength.y;
  camera_model.principal_point.x = model.principalPoint.x;
  camera_model.principal_point.y = model.principalPoint.y;
  camera_model.skew = model.skew;
  camera_model.radial_distortion.k1 = model.radialDistortion[0];
  camera_model.radial_distortion.k2 = model.radialDistortion[1];
  camera_model.radial_distortion.k3 = model.radialDistortion[2];
  camera_model.tangential_distortion.p1 = model.tangentialDistortion[0];
  camera_model.tangential_distortion.p2 = model.tangentialDistortion[1];
  info->PostResult(QueryCameraPerspectiveModel::Results::Create(
      camera_model, std::string()));
}

void DepthPhotoObject::OnQueryCameraPose(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  scoped_ptr<QueryCameraPose::Params> params(
      QueryCameraPose::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  PXCPoint3DF32 translation;
  PXCPoint4DF32 rotation;
  photo_->QueryCameraPose(params->camera_index, translation, rotation);
  CameraPose camera_pose;
  camera_pose.transition.x = translation.x;
  camera_pose.transition.y = translation.y;
  camera_pose.transition.z = translation.z;
  camera_pose.rotation.rotation_angle = rotation.w;
  camera_pose.rotation.rotation_axis_x = rotation.x;
  camera_pose.rotation.rotation_axis_y = rotation.y;
  camera_pose.rotation.rotation_axis_z = rotation.z;
  info->PostResult(QueryCameraPose::Results::Create(
      camera_pose, std::string()));
}

void DepthPhotoObject::OnQueryCameraVendorInfo(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  scoped_ptr<QueryCameraVendorInfo::Params> params(
      QueryCameraVendorInfo::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  PXCPhoto::VendorInfo vendor_info;
  photo_->QueryCameraVendorInfo(params->camera_index, vendor_info);
  VendorInfo camera_vendor;
  camera_vendor.model = base::SysWideToUTF8(vendor_info.model);
  camera_vendor.manufacturer = base::SysWideToUTF8(vendor_info.manufacturer);
  camera_vendor.notes = base::SysWideToUTF8(vendor_info.notes);
  info->PostResult(QueryCameraVendorInfo::Results::Create(
      camera_vendor, std::string()));
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
  if (!CopyImageToBinaryMessage(imColor,
                                binary_message_,
                                &binary_message_size_)) {
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

  scoped_ptr<QueryColorImage::Params> params(
      QueryColorImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  PXCImage* imColor;
  if (params->camera_index)
    imColor = photo_->QueryColorImage(*(params->camera_index.get()));
  else
    imColor = photo_->QueryColorImage();
  if (!CopyImageToBinaryMessage(imColor,
                                binary_message_,
                                &binary_message_size_)) {
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

  scoped_ptr<QueryDepthImage::Params> params(
      QueryDepthImage::Params::Create(*info->arguments()));
  if (!params) {
    info->PostResult(CreateStringErrorResult("Malformed parameters"));
    return;
  }

  PXCImage* imDepth;
  if (params->camera_index)
    imDepth = photo_->QueryDepthImage(*(params->camera_index.get()));
  else
    imDepth = photo_->QueryDepthImage();
  if (!CopyImageToBinaryMessage(imDepth,
                                binary_message_,
                                &binary_message_size_)) {
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

void DepthPhotoObject::OnQueryDeviceVendorInfo(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  PXCPhoto::VendorInfo vendor_info;
  photo_->QueryDeviceVendorInfo(vendor_info);
  VendorInfo device_vendor;
  device_vendor.model = base::SysWideToUTF8(vendor_info.model);
  device_vendor.manufacturer = base::SysWideToUTF8(vendor_info.manufacturer);
  device_vendor.notes = base::SysWideToUTF8(vendor_info.notes);
  info->PostResult(QueryDeviceVendorInfo::Results::Create(
      device_vendor, std::string()));
}

void DepthPhotoObject::OnQueryNumberOfCameras(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  pxcI32 number = photo_->QueryNumberOfCameras();
  info->PostResult(QueryNumberOfCameras::Results::Create(
      number, std::string()));
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
  if (!CopyImageToBinaryMessage(imDepth,
                                binary_message_,
                                &binary_message_size_)) {
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

void DepthPhotoObject::OnQueryXDMRevision(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  const pxcCHAR* xdm_version = photo_->QueryXDMRevision();
  info->PostResult(QueryXDMRevision::Results::Create(
      reinterpret_cast<const char*>(xdm_version), std::string()));
}

void DepthPhotoObject::OnResetContainerImage(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  if (!photo_) {
    info->PostResult(CreateStringErrorResult("Invalid photo object"));
    return;
  }

  photo_->ResetContainerImage();
  info->PostResult(ResetContainerImage::Results::Create(
      "Success", std::string()));
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

}  // namespace enhanced_photography
}  // namespace realsense
