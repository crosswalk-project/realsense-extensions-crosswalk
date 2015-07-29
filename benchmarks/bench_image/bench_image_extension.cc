// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <string>

#include "benchmarks/bench_image/bench_image_extension.h"
#include "benchmarks/bench_image/bench_image_instance.h"

xwalk::common::Extension* CreateExtension() {
  return new realsense::bench_image::BenchImageExtension;
}

// This will be generated from common_api.js
extern const char kSource_common_api[];
// This will be generated from common_promise_api.js
extern const char kSource_common_promise_api[];
// This will be generated from session_api.js.
extern const char kSource_bench_image_api[];

namespace realsense {
namespace bench_image {

BenchImageExtension::BenchImageExtension() {
  SetExtensionName("realsense.BenchImage");
  std::string jsapi(kSource_common_api);
  jsapi += kSource_common_promise_api;
  jsapi += kSource_bench_image_api;
  SetJavaScriptAPI(jsapi.c_str());
}

BenchImageExtension::~BenchImageExtension() {}

xwalk::common::Instance* BenchImageExtension::CreateInstance() {
  return new BenchImageInstance;
}

}  // namespace bench_image
}  // namespace realsense
