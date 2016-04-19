// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_HAND_WIN_HAND_INSTANCE_H_
#define REALSENSE_HAND_WIN_HAND_INSTANCE_H_

#include "base/threading/thread.h"
#include "base/values.h"
#include "xwalk/common/extension.h"
#include "xwalk/common/binding_object_store.h"
#include "xwalk/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace hand {

using xwalk::common::Instance;
using xwalk::common::XWalkExtensionFunctionInfo;

class HandInstance : public Instance {
 public:
  HandInstance();
  ~HandInstance() override;

 private:
  // common::Instance implementation.
  void HandleMessage(const char* msg) override;

  void OnHandleMessage(scoped_ptr<base::Value> msg);
  void OnHandModuleConstructor(
      scoped_ptr<XWalkExtensionFunctionInfo> info);

  xwalk::common::XWalkExtensionFunctionHandler handler_;
  xwalk::common::BindingObjectStore store_;
  base::Thread hand_ext_thread_;
};

}  // namespace hand
}  // namespace realsense

#endif  // REALSENSE_HAND_WIN_HAND_INSTANCE_H_
