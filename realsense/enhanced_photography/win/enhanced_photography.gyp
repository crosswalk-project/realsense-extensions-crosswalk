# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'targets': [
    {
      'target_name': 'enhanced_photography',
      'type': 'loadable_module',
      'dependencies':[
        '<(DEPTH)/base/base.gyp:base',
        '<(DEPTH)/extensions/third_party/libpxc/libpxc.gyp:libpxc',
        '<(DEPTH)/xwalk/common/common.gyp:common',
      ],
      'includes': [
        '../../../../xwalk/common/xwalk_js2c.gypi',
        '../../../../xwalk/common/xwalk_idlgen.gypi',
      ],
      'include_dirs': [
        '../../..',
      ],
      'variables': {
        'jsapi_namespace': 'realsense::jsapi',
        'jsapi_component': 'enhanced_photography',
      },
      'sources': [
        '../js/enhanced_photography_api.js',
        'common_utils.cc',
        'common_utils.h',
        "depth_mask.idl",
        "depth_mask_object.cc",
        "depth_mask_object.h",
        'depth_photo.idl',
        'depth_photo_object.cc',
        'depth_photo_object.h',
        'depth_refocus.idl',
        'depth_refocus_object.cc',
        'depth_refocus_object.h',
        'enhanced_photography_extension.cc',
        'enhanced_photography_extension.h',
        'enhanced_photography_instance.cc',
        'enhanced_photography_instance.h',
        'measurement.idl',
        'measurement_object.cc',
        'measurement_object.h',
        'motion_effect.idl',
        'motion_effect_object.cc',
        'motion_effect_object.h',
        'paster.idl',
        'paster_object.cc',
        'paster_object.h',
        'photo_capture.idl',
        'photo_capture_object.cc',
        'photo_capture_object.h',
        'photo_utils.idl',
        'photo_utils_object.cc',
        'photo_utils_object.h',
        'segmentation.idl',
        'segmentation_object.cc',
        'segmentation_object.h',
        'xdm_utils.idl',
        'xdm_utils_object.cc',
        'xdm_utils_object.h',
      ],
    },
  ],
}
