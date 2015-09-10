// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_OBJECT_H_
#define REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_OBJECT_H_

#include <string>
#include "xwalk/common/binding_object.h"

namespace realsense {
namespace bench_image {

class BenchImageObject : public xwalk::common::BindingObject {
 public:
  BenchImageObject();
  ~BenchImageObject() override;

 private:
  void OnGetSampleLong(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetSampleString(
    scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  uint32 GeneratePixel();
  uint32 frame_count;
};

}  // namespace bench_image
}  // namespace realsense

#endif  // REALSENSE_BENCHMARKS_BENCH_IMAGE_BENCH_IMAGE_OBJECT_H_
