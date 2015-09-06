# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'variables': {
    'make_apk_path%': '<!(which make_apk.py)',
    'app_runtime_java_jar%': '<!(find -L $(dirname $(which make_apk.py)) -name xwalk_app_runtime_java.jar|tail -1)',
    'rssdk_path%': '',
  },
}
