# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'sceneperception',
      'type': 'loadable_module',
      'includes': [
        '../common/rssdk.gypi',
        '../common/xwalk_js2c.gypi',
        '../common/xwalk_idlgen.gypi',
      ],
      'variables': {
        'jsapi_component': 'sceneperception',
      },
      'sources': [
        'sceneperception.idl',
        'sceneperception_api.js',
        'sceneperception_extension.cc',
        'sceneperception_extension.h',
        'sceneperception_instance.cc',
        'sceneperception_instance.h',
        'sceneperception_object.cc',
        'sceneperception_object.h'
      ],
    },
  ],
}
