// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

(function() {

  test(function() {
    assert_own_property(window, 'realsense', 'realsense module is not supported');
  }, 'Check that window supports realsense');

  test(function() {
    assert_equals(typeof realsense, 'object', 'realsense is not object');
    assert_not_equals(realsense, null, 'realsense is null');
  }, 'Check that realsense is type of object');

})();
