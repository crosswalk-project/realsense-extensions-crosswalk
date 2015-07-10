# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'realsense',
      'type': 'none',
      'dependencies': [
        'enhanced_photography/enhanced_photography.gyp:*',
        'scene_perception/scene_perception.gyp:*',
        'session/session.gyp:*',
      ]
    },
  ],
}
