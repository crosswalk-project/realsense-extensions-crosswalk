// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SESSION_SESSION_INSTANCE_H_
#define REALSENSE_SESSION_SESSION_INSTANCE_H_

#include "xwalk/common/extension.h"
#include "xwalk/common/binding_object_store.h"
#include "xwalk/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace session {

class SessionInstance : public xwalk::common::Instance {
 public:
  SessionInstance();
  virtual ~SessionInstance();

 private:
  virtual void HandleMessage(const char* msg);
  virtual void HandleSyncMessage(const char* msg);

  void OnSessionConstructor(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  xwalk::common::XWalkExtensionFunctionHandler handler_;
  xwalk::common::BindingObjectStore store_;
};

}  // namespace session
}  // namespace realsense

#endif  // REALSENSE_SESSION_SESSION_INSTANCE_H_
