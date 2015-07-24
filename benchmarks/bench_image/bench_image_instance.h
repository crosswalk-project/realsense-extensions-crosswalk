// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_INSTANCE_H_
#define REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_INSTANCE_H_

#include "xwalk/common/extension.h"
#include "xwalk/common/binding_object_store.h"
#include "xwalk/common/xwalk_extension_function_handler.h"

namespace realsense {
namespace bench_image {

class BenchImageInstance : public xwalk::common::Instance {
 public:
  BenchImageInstance();
  ~BenchImageInstance() override;

 private:
  void HandleMessage(const char* msg) override;
  void HandleSyncMessage(const char* msg) override;

  void OnBenchImageConstructor(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  xwalk::common::XWalkExtensionFunctionHandler handler_;
  xwalk::common::BindingObjectStore store_;
};

}  // namespace bench_image
}  // namespace realsense

#endif  // REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_INSTANCE_H_
