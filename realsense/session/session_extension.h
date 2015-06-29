// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SESSION_SESSION_EXTENSION_H_
#define REALSENSE_SESSION_SESSION_EXTENSION_H_

#include "realsense/common/extension.h"

namespace realsense {
namespace session {

class SessionExtension : public realsense::common::Extension {
 public:
  SessionExtension();
  virtual ~SessionExtension();

 private:
  // realsense::common::Extension implementation.
  virtual realsense::common::Instance* CreateInstance();
};

}  // namespace session
}  // namespace realsense

#endif  // REALSENSE_SESSION_SESSION_EXTENSION_H_
