// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SESSION_SESSION_OBJECT_H_
#define REALSENSE_SESSION_SESSION_OBJECT_H_

#include <string>
#include "xwalk/common/event_target.h"

namespace realsense {
namespace session {

class SessionObject : public xwalk::common::EventTarget {
 public:
  SessionObject();
  ~SessionObject() override;

  // EventTarget implementation.
  void StartEvent(const std::string& type) override;
  void StopEvent(const std::string& type) override;

 private:
  void OnGetVersion(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
};

}  // namespace session
}  // namespace realsense

#endif  // REALSENSE_SESSION_SESSION_OBJECT_H_
