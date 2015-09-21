# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'benchmarks',
      'type': 'none',
      'conditions': [
        ['OS=="win"', {
          'dependencies': [
            'bench_image/win/bench_image.gyp:*',
          ]
        }],
      ],
    },
  ],
}
