// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>
#include <sstream>

#include "pxcsession.h" // NOLINT

#include "realsense/session/session_object.h"
#include "realsense/session/session.h"

namespace realsense {
namespace session {

using namespace realsense::jsapi::session; // NOLINT
using namespace realsense::common; // NOLINT

SessionObject::SessionObject() {
  handler_.Register("getVersion",
                    base::Bind(&SessionObject::OnGetVersion,
                               base::Unretained(this)));
}

SessionObject::~SessionObject() {
}

void SessionObject::StartEvent(const std::string& type) {
  NOTIMPLEMENTED();
}

void SessionObject::StopEvent(const std::string& type) {
  NOTIMPLEMENTED();
}

void SessionObject::OnGetVersion(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  PXCSession* session = PXCSession::CreateInstance();
  PXCSession::ImplVersion ver = session->QueryVersion();
  session->Release();
  std::ostringstream major, minor;
  major << ver.major;
  minor << ver.minor;

  scoped_ptr<Version> version(new Version());
  version->major = major.str();
  version->minor = minor.str();
  info->PostResult(GetVersion::Results::Create(*version, std::string()));
}

}  // namespace session
}  // namespace realsense
