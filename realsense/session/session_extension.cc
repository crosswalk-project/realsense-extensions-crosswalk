// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>

#include "realsense/session/session_extension.h"
#include "realsense/session/session_instance.h"

xwalk::common::Extension* CreateExtension() {
  return new realsense::session::SessionExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from session_api.js.
extern const char kSource_session_api[];

namespace realsense {
namespace session {

SessionExtension::SessionExtension() {
  SetExtensionName("realsense.session");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_session_api;
  SetJavaScriptAPI(jsapi.c_str());
}

SessionExtension::~SessionExtension() {}

xwalk::common::Instance* SessionExtension::CreateInstance() {
  return new SessionInstance();
}

}  // namespace session
}  // namespace realsense
