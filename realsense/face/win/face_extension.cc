// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/face/win/face_extension.h"

#include <string>

#include "base/at_exit.h"
#include "realsense/face/win/face_instance.h"

base::AtExitManager exit_manager;

xwalk::common::Extension* CreateExtension() {
  return new realsense::face::FaceExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from face_api.js.
extern const char kSource_face_api[];

namespace realsense {
namespace face {

FaceExtension::FaceExtension() {
  SetExtensionName("realsense.Face");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_face_api;
  SetJavaScriptAPI(jsapi.c_str());
}

FaceExtension::~FaceExtension() {}

xwalk::common::Instance* FaceExtension::CreateInstance() {
  return new FaceInstance();
}

}  // namespace face
}  // namespace realsense
