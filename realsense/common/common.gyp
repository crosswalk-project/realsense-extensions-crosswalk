# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'common',
      'type': 'static_library',
      'includes': [
        'xwalk_js2c.gypi',
        'xwalk_idlgen.gypi',
      ],
      'variables': {
        'jsapi_component': 'common',
      },
      'include_dirs': [
        '../..',
      ],
      'sources': [
        'binding_object.h',
        'binding_object_store.cc',
        'binding_object_store.h',
        'common.idl',
        'common_api.js',
        'common_promise_api.js',
        'event_target.cc',
        'event_target.h',
        'extension.cc',
        'extension.h',
        'picojson.h',
        'utils.h',
        'XW_Extension.h',
        'XW_Extension_EntryPoints.h',
        'XW_Extension_Permissions.h',
        'XW_Extension_Runtime.h',
        'XW_Extension_SyncMessage.h',
        'xwalk_extension_function_handler.cc',
        'xwalk_extension_function_handler.h',
      ],
    }
  ]
}
