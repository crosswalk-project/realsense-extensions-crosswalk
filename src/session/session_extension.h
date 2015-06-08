// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef SRC_SESSION_SESSION_EXTENSION_H_
#define SRC_SESSION_SESSION_EXTENSION_H_

#include "common/extension.h"

class SessionExtension : public common::Extension {
 public:
  SessionExtension();
  virtual ~SessionExtension();

 private:
  // common::Extension implementation.
  virtual common::Instance* CreateInstance();
};

#endif  // SRC_SESSION_SESSION_EXTENSION_H_
