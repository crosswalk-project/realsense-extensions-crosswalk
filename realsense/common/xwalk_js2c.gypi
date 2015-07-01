# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'rules': [
    {
      'rule_name': 'xwalk_js2c',
      'extension': 'js',
      'inputs': [
        '<(DEPTH)/tools/generate_api.py',
      ],
      'outputs': [
        '<(SHARED_INTERMEDIATE_DIR)/<(RULE_INPUT_ROOT).cc'
      ],
      'process_outputs_as_sources': 1,
      'action': [
        'python',
        '<@(_inputs)',
        '<(RULE_INPUT_PATH)',
        'kSource_<(RULE_INPUT_ROOT)',
        '<@(_outputs)',
      ],
      'message': 'Generating code from <(RULE_INPUT_PATH)',
    },
  ],
}
