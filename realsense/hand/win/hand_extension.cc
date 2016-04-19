// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/hand/win/hand_extension.h"

#include <string>

#include "base/at_exit.h"
#include "realsense/hand/win/hand_instance.h"

base::AtExitManager exit_manager;

xwalk::common::Extension* CreateExtension() {
  return new realsense::hand::HandExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from hand_api.js.
extern const char kSource_hand_api[];

namespace realsense {
namespace hand {

HandExtension::HandExtension() {
  SetExtensionName("realsense.Hand");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_hand_api;
  SetJavaScriptAPI(jsapi.c_str());
}

HandExtension::~HandExtension() {}

xwalk::common::Instance* HandExtension::CreateInstance() {
  return new HandInstance();
}

}  // namespace hand
}  // namespace realsense
