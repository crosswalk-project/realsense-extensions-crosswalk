// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_FACE_TRACKING_FACE_TRACKING_INSTANCE_H_
#define REALSENSE_FACE_TRACKING_FACE_TRACKING_INSTANCE_H_

#include "base/threading/thread.h"
#include "base/values.h"
#include "xwalk/common/extension.h"
#include "xwalk/common/binding_object_store.h"
#include "xwalk/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace face_tracking {

using xwalk::common::Instance;
using xwalk::common::XWalkExtensionFunctionInfo;

class FaceTrackingInstance : public Instance {
 public:
  FaceTrackingInstance();
  ~FaceTrackingInstance() override;

 private:
  // common::Instance implementation.
  void HandleMessage(const char* msg) override;

  void OnHandleMessage(scoped_ptr<base::Value> msg);
  void OnFaceTrackingConstructor(
      scoped_ptr<XWalkExtensionFunctionInfo> info);

  xwalk::common::XWalkExtensionFunctionHandler handler_;
  xwalk::common::BindingObjectStore store_;
  base::Thread ft_ext_thread_;
};

}  // namespace face_tracking
}  // namespace realsense

#endif  // REALSENSE_FACE_TRACKING_FACE_TRACKING_INSTANCE_H_
