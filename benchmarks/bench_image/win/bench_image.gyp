# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'bench_image',
      'type': 'loadable_module',
      'includes': [
        '../../../../xwalk/common/xwalk_js2c.gypi',
        '../../../../xwalk/common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../../..',
      ],
      'dependencies': [
        '<(DEPTH)/base/base.gyp:base',
        '<(DEPTH)/third_party/modp_b64/modp_b64.gyp:modp_b64',
        '<(DEPTH)/xwalk/common/common.gyp:common',
      ],
      'variables': {
        'jsapi_namespace': 'realsense::jsapi',
        'jsapi_component': 'bench_image',
      },
      'sources': [
        'bench_image_extension.cc',
        'bench_image_extension.h',
        'bench_image_instance.cc',
        'bench_image_instance.h',
        'bench_image_api.js',
        'bench_image.idl',
        'bench_image_object.cc',
        'bench_image_object.h'
      ],
    },
  ],
}
