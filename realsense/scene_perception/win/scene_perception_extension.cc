// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>

#include "base/at_exit.h"
#include "realsense/scene_perception/win/scene_perception_extension.h"
#include "realsense/scene_perception/win/scene_perception_instance.h"

base::AtExitManager exit_manager;

xwalk::common::Extension* CreateExtension() {
  return new realsense::scene_perception::ScenePerceptionExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from scene_perception_api.js.
extern const char kSource_scene_perception_api[];

namespace realsense {
namespace scene_perception {

ScenePerceptionExtension::ScenePerceptionExtension() {
  SetExtensionName("realsense.ScenePerception");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_scene_perception_api;
  SetJavaScriptAPI(jsapi.c_str());
}

ScenePerceptionExtension::~ScenePerceptionExtension() {}

xwalk::common::Instance* ScenePerceptionExtension::CreateInstance() {
  return new ScenePerceptionInstance();
}

}  // namespace scene_perception
}  // namespace realsense
