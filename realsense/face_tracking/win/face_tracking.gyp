# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'face',
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
        'jsapi_component': 'face_tracking',
      },
      'sources': [
        'face_tracking.idl',
        'face_tracking_api.js',
        'face_tracking_extension.cc',
        'face_tracking_extension.h',
        'face_tracking_instance.cc',
        'face_tracking_instance.h',
        'face_tracking_object.cc',
        'face_tracking_object.h'
      ],
    },
  ],
}
