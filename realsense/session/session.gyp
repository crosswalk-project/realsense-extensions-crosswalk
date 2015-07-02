# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'session',
      'type': 'loadable_module',
      'includes': [
        '../common/rssdk.gypi',
        '../common/xwalk_js2c.gypi',
        '../common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../..',
      ],
      'variables': {
        'jsapi_component': 'session',
      },
      'sources': [
        'session.idl',
        'session_api.js',
        'session_extension.cc',
        'session_extension.h',
        'session_instance.cc',
        'session_instance.h',
        'session_object.cc',
        'session_object.h'
      ],
    },
  ],
}
