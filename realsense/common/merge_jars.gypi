# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'actions': [
    {
      'action_name': 'merge_jars_<(_target_name)',
      'message': 'Creating <(_target_name) jar',
      'inputs': [
        '<(DEPTH)/extensions/build/android/merge_jars.py',
        '>@(jars_to_merge)',
      ],
      'outputs': [
        '<(merged_jar_path)',
      ],
      'action': [
        'python', '<(DEPTH)/extensions/build/android/merge_jars.py',
        '--jars=>(jars_to_merge)',
        '--jar-path=<(merged_jar_path)',
      ],
    },
  ],
}
