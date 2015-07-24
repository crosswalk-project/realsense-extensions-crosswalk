// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_EXTENSION_H_
#define REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_EXTENSION_H_

#include "xwalk/common/extension.h"

namespace realsense {
namespace bench_image {

class BenchImageExtension : public xwalk::common::Extension {
 public:
  BenchImageExtension();
  ~BenchImageExtension() override;
 private:
  // realsense::common::Extension implementation.
  xwalk::common::Instance* CreateInstance() override;
};

}  // namespace bench_image
}  // namespace realsense

#endif  // REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_EXTENSION_H_
