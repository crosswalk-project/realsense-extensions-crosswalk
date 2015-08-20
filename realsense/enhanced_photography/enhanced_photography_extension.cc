// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/enhanced_photography_extension.h"

#include <string>

#include "base/at_exit.h"
#include "realsense/enhanced_photography/enhanced_photography_instance.h"

base::AtExitManager exit_manager;

xwalk::common::Extension* CreateExtension() {
  return new realsense::enhanced_photography::EnhancedPhotographyExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from enhanced_photography_api.js.
extern const char kSource_enhanced_photography_api[];

namespace realsense {
namespace enhanced_photography {

EnhancedPhotographyExtension::EnhancedPhotographyExtension() {
  SetExtensionName("realsense.EnhancedPhotography");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_enhanced_photography_api;
  SetJavaScriptAPI(jsapi.c_str());
}

EnhancedPhotographyExtension::~EnhancedPhotographyExtension() {}

xwalk::common::Instance* EnhancedPhotographyExtension::CreateInstance() {
  return new EnhancedPhotographyInstance();
}

}  // namespace enhanced_photography
}  // namespace realsense
