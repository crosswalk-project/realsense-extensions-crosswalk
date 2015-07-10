// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>
#include <sstream>
#include "base/json/json_string_value_serializer.h"
#include "base/values.h"
#include "bench_image.h" // NOLINT
#include "realsense/benchmarks/bench_image/bench_image_instance.h"
#include "realsense/benchmarks/bench_image/bench_image_object.h"

namespace realsense {
namespace bench_image {

using namespace xwalk::common; // NOLINT
using realsense::jsapi::bench_image::BenchImageConstructor::Params;

BenchImageInstance::BenchImageInstance()
    : handler_(this),
      store_(&handler_) {
  handler_.Register("benchImageConstructor",
      base::Bind(&BenchImageInstance::OnBenchImageConstructor,
                 base::Unretained(this)));
}

BenchImageInstance::~BenchImageInstance() {
}

void BenchImageInstance::HandleSyncMessage(const char* msg) {
  NOTIMPLEMENTED();
}

void BenchImageInstance::HandleMessage(const char* msg) {
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

void BenchImageInstance::OnBenchImageConstructor(
    scoped_ptr<XWalkExtensionFunctionInfo> info) {
  scoped_ptr<Params> params(Params::Create(*info->arguments()));

  scoped_ptr<BindingObject> obj(new BenchImageObject());
  store_.AddBindingObject(params->object_id, obj.Pass());
}

}  // namespace bench_image
}  // namespace realsense
