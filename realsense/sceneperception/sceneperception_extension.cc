// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>

#include "base/at_exit.h"
#include "realsense/sceneperception/sceneperception_extension.h"
#include "realsense/sceneperception/sceneperception_instance.h"

base::AtExitManager exit_manager;

realsense::common::Extension* CreateExtension() {
  return new realsense::sceneperception::ScenePerceptionExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from sceneperception_api.js.
extern const char kSource_sceneperception_api[];

namespace realsense {
namespace sceneperception {

ScenePerceptionExtension::ScenePerceptionExtension() {
  SetExtensionName("realsense.ScenePerception");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_sceneperception_api;
  SetJavaScriptAPI(jsapi.c_str());
}

ScenePerceptionExtension::~ScenePerceptionExtension() {}

common::Instance* ScenePerceptionExtension::CreateInstance() {
  return new ScenePerceptionInstance();
}

}  // namespace sceneperception
}  // namespace realsense
