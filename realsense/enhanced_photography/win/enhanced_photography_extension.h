// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_EXTENSION_H_
#define REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace enhanced_photography {

class EnhancedPhotographyExtension : public xwalk::common::Extension {
 public:
  EnhancedPhotographyExtension();
  ~EnhancedPhotographyExtension() override;

 private:
  // realsense::common::Extension implementation.
  xwalk::common::Instance* CreateInstance() override;
};

}  // namespace enhanced_photography
}  // namespace realsense

#endif  // REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_EXTENSION_H_
