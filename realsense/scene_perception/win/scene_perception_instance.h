// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_INSTANCE_H_
#define REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_INSTANCE_H_

#include "base/threading/thread.h"
#include "xwalk/common/extension.h"
#include "xwalk/common/binding_object_store.h"
#include "xwalk/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace scene_perception {

class ScenePerceptionInstance : public xwalk::common::Instance {
 public:
  ScenePerceptionInstance();
  ~ScenePerceptionInstance() override;

 private:
  void HandleMessage(const char* msg) override;
  void HandleSyncMessage(const char* msg) override;

  // Called on sp_ext_thread_
  void OnHandleMessage(scoped_ptr<base::Value> msg);
  void OnScenePerceptionConstructor(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  xwalk::common::XWalkExtensionFunctionHandler handler_;
  xwalk::common::BindingObjectStore store_;
  base::Thread sp_ext_thread_;
};

}  // namespace scene_perception
}  // namespace realsense

#endif  // REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_INSTANCE_H_
