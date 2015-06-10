// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/session/session_extension.h"
#include "realsense/session/session_instance.h"

common::Extension* CreateExtension() {
  return new SessionExtension;
}

// This will be generated from session_api.js.
extern const char kSource_session_api[];

SessionExtension::SessionExtension() {
  SetExtensionName("realsense.session");
  SetJavaScriptAPI(kSource_session_api);
}

SessionExtension::~SessionExtension() {}

common::Instance* SessionExtension::CreateInstance() {
  return new SessionInstance();
}
