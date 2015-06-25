// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef SRC_REALSENSE_SESSION_SESSION_INSTANCE_H_
#define SRC_REALSENSE_SESSION_SESSION_INSTANCE_H_

#include "realsense/common/extension.h"
#include "realsense/common/binding_object_store.h"
#include "realsense/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace session {

class SessionInstance : public realsense::common::Instance {
 public:
  SessionInstance();
  virtual ~SessionInstance();

 private:
  virtual void HandleMessage(const char* msg);
  virtual void HandleSyncMessage(const char* msg);

  void OnSessionConstructor(
      scoped_ptr<realsense::common::XWalkExtensionFunctionInfo> info);

  realsense::common::XWalkExtensionFunctionHandler handler_;
  realsense::common::BindingObjectStore store_;
};

}  // namespace session
}  // namespace realsense

#endif  // SRC_REALSENSE_SESSION_SESSION_INSTANCE_H_
