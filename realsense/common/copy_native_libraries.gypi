# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'actions': [
    {
      'action_name': 'make_jni_dir_<(_target_name)',
      'message': 'Make JNI Directory of <(_target_name)',
      'inputs': [
        '<(extension_dir)',
      ],
      'outputs': [
        # TODO(shawn): Should be '<(extension_dir)/jni/x86'.
        # But conflict to the output of next action.
        # To avoid "multiple rules generate same target" error.
        # Remove 'x86'.
        '<(extension_dir)/jni',
      ],
      'action': [
        'mkdir',
        '-p',
        '<(extension_dir)/jni/x86',
      ]
    },
    {
      'action_name': 'copy_native_libraries_<(_target_name)',
      'message': 'Copying native libraries of <(_target_name)',
      'inputs': [
        '<(extension_dir)/jni',
      ],
      'outputs': [
        '<(extension_dir)/jni/x86',
      ],
      'action': [
        'cp',
        '>@(native_libraries)',
        '<(extension_dir)/jni/x86/',
      ]
    },
  ],
}
