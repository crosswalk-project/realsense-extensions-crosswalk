// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/face_tracking/win/face_tracking_extension.h"

#include <string>

#include "base/at_exit.h"
#include "realsense/face_tracking/win/face_tracking_instance.h"

base::AtExitManager exit_manager;

xwalk::common::Extension* CreateExtension() {
  return new realsense::face_tracking::FaceTrackingExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from face_tracking_api.js.
extern const char kSource_face_tracking_api[];

namespace realsense {
namespace face_tracking {

FaceTrackingExtension::FaceTrackingExtension() {
  SetExtensionName("realsense.Face");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_face_tracking_api;
  SetJavaScriptAPI(jsapi.c_str());
}

FaceTrackingExtension::~FaceTrackingExtension() {}

xwalk::common::Instance* FaceTrackingExtension::CreateInstance() {
  return new FaceTrackingInstance();
}

}  // namespace face_tracking
}  // namespace realsense
