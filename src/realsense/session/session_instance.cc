// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>
#include <sstream>

#include "pxcsession.h"  // NOLINT(*)

#include "realsense/session/session_instance.h"

#include "base/json/json_string_value_serializer.h"
#include "base/values.h"
#include "realsense/session/session.h"
#include "realsense/session/session_object.h"

namespace realsense {
namespace session {

using namespace realsense::common; // NOLINT
using realsense::jsapi::session::SessionConstructor::Params;

SessionInstance::SessionInstance()
    : handler_(this),
      store_(&handler_) {
  handler_.Register("sessionConstructor",
      base::Bind(&SessionInstance::OnSessionConstructor,
                 base::Unretained(this)));
}

SessionInstance::~SessionInstance() {
}

void SessionInstance::HandleSyncMessage(const char* msg) {
  NOTIMPLEMENTED();
}

void SessionInstance::HandleMessage(const char* msg) {
  JSONStringValueDeserializer str_deserializer(msg);

  int error_code = 0;
  std::string error_message;
  scoped_ptr<base::Value> value(
      str_deserializer.Deserialize(&error_code, &error_message));
  CHECK(value.get());
  CHECK_EQ(0, error_code);
  CHECK(error_message.empty());

  handler_.HandleMessage(value.Pass());
}

void SessionInstance::OnSessionConstructor(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<Params> params(Params::Create(*info->arguments()));

  scoped_ptr<BindingObject> obj(new SessionObject());
  store_.AddBindingObject(params->object_id, obj.Pass());
}

}  // namespace session
}  // namespace realsense
