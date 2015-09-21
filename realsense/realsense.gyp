# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'realsense',
      'type': 'none',
      'conditions': [
        ['OS=="win"', {
          'dependencies': [
            'enhanced_photography/win/enhanced_photography.gyp:*',
            'face_tracking/win/face_tracking.gyp:*',
            'scene_perception/win/scene_perception.gyp:*',
            'session/win/session.gyp:*',
          ]
        }],
        ['OS=="android"', {
          'dependencies': [
            'enhanced_photography/android/enhanced_photography.gyp:*',
          ]
        }],
      ], # conditions
    },
  ],
}
