// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef SRC_SESSION_SESSION_INSTANCE_H_
#define SRC_SESSION_SESSION_INSTANCE_H_

#include "realsense/common/extension.h"
#include "realsense/common/picojson.h"

class SessionInstance : public common::Instance {
 public:
  SessionInstance() {}
  virtual ~SessionInstance() {}

 private:
  virtual void HandleMessage(const char* msg) {}
  virtual void HandleSyncMessage(const char* msg);

  void HandleGetVersion();

  void SendSyncMessage(int err_code, const picojson::value& data);
};

#endif  // SRC_SESSION_SESSION_INSTANCE_H_
