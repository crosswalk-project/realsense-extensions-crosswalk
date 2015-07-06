// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_EXTENSION_H_
#define REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace scene_perception {

class ScenePerceptionExtension : public xwalk::common::Extension {
 public:
  ScenePerceptionExtension();
  virtual ~ScenePerceptionExtension();

 private:
  // xwalk::common::Extension implementation.
  virtual xwalk::common::Instance* CreateInstance();
};

}  // namespace scene_perception
}  // namespace realsense

#endif  // REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_EXTENSION_H_
