# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'scene_perception',
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
        'jsapi_component': 'scene_perception',
      },
      'sources': [
        'scene_perception.idl',
        'scene_perception_api.js',
        'scene_perception_extension.cc',
        'scene_perception_extension.h',
        'scene_perception_instance.cc',
        'scene_perception_instance.h',
        'scene_perception_object.cc',
        'scene_perception_object.h'
      ],
    },
  ],
}
