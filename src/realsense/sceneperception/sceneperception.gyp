# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'sceneperception',
      'type': 'loadable_module',
      'includes': [
        '../common/xwalk_js2c.gypi',
        '../common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../..',
        '<!(echo %RSSDK_DIR%\include)',
      ],
      'dependencies': [
        '../../base/base.gyp:base',
        '../common/common.gyp:common',
      ],
      'variables': {
        'jsapi_component': 'sceneperception',
      },
      'msvs_settings': {
        'VCLinkerTool': {
          'AdditionalDependencies': [
            'advapi32.lib',
          ],
          'AdditionalLibraryDirectories': [
            '<!(echo %RSSDK_DIR%\lib\Win32)',
          ],
        },
      },
      'configurations': {
        'Debug': {
          'msvs_settings': {
            'VCLinkerTool': {
              'AdditionalDependencies': [
                'libpxc_d.lib'
              ],
            },
          },
        },
        'Release': {
          'msvs_settings': {
            'VCLinkerTool': {
              'AdditionalDependencies': [
                'libpxc.lib'
              ],
            },
          },
        }
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
