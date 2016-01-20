# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'face',
      'type': 'loadable_module',
      'dependencies':[
        '<(DEPTH)/base/base.gyp:base',
        '<(DEPTH)/extensions/third_party/libpxc/libpxc.gyp:libpxc',
        '<(DEPTH)/xwalk/common/common.gyp:common',
      ],
      'includes': [
        '../../../../xwalk/common/xwalk_js2c.gypi',
        '../../../../xwalk/common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../../..',
      ],
      'variables': {
        'jsapi_namespace': 'realsense::jsapi',
        'jsapi_component': 'face',
      },
      'sources': [
        'face_module.idl',
        '../js/face_api.js',
        'face_extension.cc',
        'face_extension.h',
        'face_instance.cc',
        'face_instance.h',
        'face_module_object.cc',
        'face_module_object.h'
      ],
    },
  ],
}
