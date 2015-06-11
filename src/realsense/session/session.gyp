# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'session',
      'type': 'loadable_module',
      'includes': [
        '../common/xwalk_js2c.gypi',
      ],
      'include_dirs': [
        '../..',
        '<!(echo %RSSDK_DIR%\include)',
      ],
      'dependencies': [
        '../../base/base.gyp:base',
        '../common/xw_extension.gyp:xw_extension',
      ],
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
        'session_api.js',
        'session_extension.cc',
        'session_extension.h',
        'session_instance.cc',
        'session_instance.h',
      ],
    },
  ],
}
