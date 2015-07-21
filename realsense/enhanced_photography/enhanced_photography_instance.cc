// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "realsense/enhanced_photography/enhanced_photography_instance.h"

#include <string>

#include "base/json/json_string_value_serializer.h"
#include "realsense/enhanced_photography/enhanced_photography_object.h"
#include "xwalk/enhanced_photography/enhanced_photography.h"

namespace realsense {
namespace enhanced_photography {

using namespace xwalk::common; // NOLINT
using jsapi::enhanced_photography::EnhancedPhotographyConstructor::Params;

EnhancedPhotographyInstance::EnhancedPhotographyInstance()
    : handler_(this),
      store_(&handler_),
      ep_ext_thread_("EPExtensionThread") {
  ep_ext_thread_.Start();
  handler_.Register("enhancedPhotographyConstructor",
      base::Bind(&EnhancedPhotographyInstance::OnEnhancedPhotographyConstructor,
                 base::Unretained(this)));
}

EnhancedPhotographyInstance::~EnhancedPhotographyInstance() {
  ep_ext_thread_.Stop();
}

void EnhancedPhotographyInstance::HandleMessage(const char* msg) {
  JSONStringValueDeserializer str_deserializer(msg);

  int error_code = 0;
  std::string error_message;
  scoped_ptr<base::Value> value(
      str_deserializer.Deserialize(&error_code, &error_message));
  CHECK(value.get());
  CHECK_EQ(0, error_code);
  CHECK(error_message.empty());

  ep_ext_thread_.message_loop()->PostTask(
      FROM_HERE,
      base::Bind(&EnhancedPhotographyInstance::OnHandleMessage,
                 base::Unretained(this),
                 base::Passed(&value)));
}

void EnhancedPhotographyInstance::OnHandleMessage(scoped_ptr<base::Value> msg) {
  DCHECK_EQ(ep_ext_thread_.message_loop(), base::MessageLoop::current());
  handler_.HandleMessage(msg.Pass());
}

void EnhancedPhotographyInstance::OnEnhancedPhotographyConstructor(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  DCHECK_EQ(ep_ext_thread_.message_loop(), base::MessageLoop::current());
  scoped_ptr<Params> params(Params::Create(*info->arguments()));

  scoped_ptr<BindingObject> obj(new EnhancedPhotographyObject(this));
  store_.AddBindingObject(params->object_id, obj.Pass());
}

void EnhancedPhotographyInstance::AddBindingObject(const std::string& object_id,
    scoped_ptr<BindingObject> obj) {
  store_.AddBindingObject(object_id, obj.Pass());
}

BindingObject* EnhancedPhotographyInstance::GetBindingObjectById(
    const std::string& object_id) {
  return store_.GetBindingObjectById(object_id);
}

}  // namespace enhanced_photography
}  // namespace realsense
