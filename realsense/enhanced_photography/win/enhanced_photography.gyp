# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'enhanced_photography',
      'type': 'loadable_module',
      'includes': [
        '../../common/rssdk.gypi',
        '../../../../xwalk/common/xwalk_js2c.gypi',
        '../../../../xwalk/common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../../..',
      ],
      'variables': {
        'jsapi_namespace': 'realsense::jsapi',
        'jsapi_component': 'enhanced_photography',
      },
      'sources': [
        '../js/enhanced_photography_api.js',
        'depth_photo.idl',
        'depth_photo_object.cc',
        'depth_photo_object.h',
        'enhanced_photography.idl',
        'enhanced_photography_extension.cc',
        'enhanced_photography_extension.h',
        'enhanced_photography_instance.cc',
        'enhanced_photography_instance.h',
        'enhanced_photography_object.cc',
        'enhanced_photography_object.h'
      ],
    },
  ],
}
