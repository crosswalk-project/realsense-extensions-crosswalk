// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "session/session_instance.h"

#include <string>
#include <sstream>

#include "pxcsession.h"  // NOLINT(*)

const char cmdGetVersion[] = "getVersion";

void SessionInstance::HandleSyncMessage(const char* msg) {
  picojson::value msg_obj;
  std::string err;
  picojson::parse(msg_obj, msg, msg + strlen(msg), &err);
  if (!err.empty()) {
    return;
  }

  std::string cmdName = msg_obj.get("cmd").to_str();
  if (cmdName == cmdGetVersion)
    HandleGetVersion();
}

void SessionInstance::HandleGetVersion() {
  PXCSession* session = PXCSession::CreateInstance();
  PXCSession::ImplVersion ver = session->QueryVersion();
  session->Release();
  std::ostringstream major, minor;
  major << ver.major;
  minor << ver.minor;

  picojson::object obj;
  obj["major"] = picojson::value(major.str());
  obj["minor"] = picojson::value(minor.str());
  picojson::value val(obj);
  SendSyncReply(val.serialize().c_str());
}
