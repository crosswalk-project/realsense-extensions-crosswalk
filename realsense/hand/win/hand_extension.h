// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_HAND_WIN_HAND_EXTENSION_H_
#define REALSENSE_HAND_WIN_HAND_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace hand {

class HandExtension : public xwalk::common::Extension {
 public:
  HandExtension();
  ~HandExtension() override;

 private:
  // realsense::common::Extension implementation.
  xwalk::common::Instance* CreateInstance() override;
};

}  // namespace hand
}  // namespace realsense

#endif  // REALSENSE_HAND_WIN_HAND_EXTENSION_H_
