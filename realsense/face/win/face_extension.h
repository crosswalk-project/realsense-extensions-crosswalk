// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_FACE_WIN_FACE_EXTENSION_H_
#define REALSENSE_FACE_WIN_FACE_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace face {

class FaceExtension : public xwalk::common::Extension {
 public:
  FaceExtension();
  ~FaceExtension() override;

 private:
  // realsense::common::Extension implementation.
  xwalk::common::Instance* CreateInstance() override;
};

}  // namespace face
}  // namespace realsense

#endif  // REALSENSE_FACE_WIN_FACE_EXTENSION_H_
