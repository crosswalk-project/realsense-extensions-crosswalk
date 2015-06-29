// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SCENEPERCEPTION_SCENEPERCEPTION_EXTENSION_H_
#define REALSENSE_SCENEPERCEPTION_SCENEPERCEPTION_EXTENSION_H_

#include "realsense/common/extension.h"

namespace realsense {
namespace sceneperception {

class ScenePerceptionExtension : public realsense::common::Extension {
 public:
  ScenePerceptionExtension();
  virtual ~ScenePerceptionExtension();

 private:
  // realsense::common::Extension implementation.
  virtual realsense::common::Instance* CreateInstance();
};

}  // namespace sceneperception
}  // namespace realsense

#endif  // REALSENSE_SCENEPERCEPTION_SCENEPERCEPTION_EXTENSION_H_
