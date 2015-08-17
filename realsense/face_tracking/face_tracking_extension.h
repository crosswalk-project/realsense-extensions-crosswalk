// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_FACE_TRACKING_FACE_TRACKING_EXTENSION_H_
#define REALSENSE_FACE_TRACKING_FACE_TRACKING_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace face_tracking {

class FaceTrackingExtension : public xwalk::common::Extension {
 public:
  FaceTrackingExtension();
  ~FaceTrackingExtension() override;

 private:
  // realsense::common::Extension implementation.
  xwalk::common::Instance* CreateInstance() override;
};

}  // namespace face_tracking
}  // namespace realsense

#endif  // REALSENSE_FACE_TRACKING_FACE_TRACKING_EXTENSION_H_
