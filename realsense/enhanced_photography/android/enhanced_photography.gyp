# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'includes':[
    '../../common/paths_android.gypi',
  ],
  'targets': [
    {
      'target_name': 'enhanced_photography',
      'type': 'none',
      'dependencies': [
        '<(DEPTH)/xwalk/common/android/common.gyp:common',
      ],
      'variables': {
        'extension_dir': '<(PRODUCT_DIR)/<(_target_name)',
        'java_in_dir': '.',
        'input_jars_paths': [
          '<(app_runtime_java_jar)',
          '<(android_jar)',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCASenseManager/classes.jar',
        ],
        'jars_to_merge': [
          '<(jar_dir)/common.jar',
          '<(jar_final_path)',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCASenseManager/classes.jar',
        ],
        'merged_jar_path': '<(extension_dir)/<(_target_name).jar',
        'js_files_to_merge': [
            '../../../../xwalk/common/common_api.js',
            '../js/enhanced_photography_api.js',
        ],
        'js_file': '<(_target_name).js',
        'json_file': '<(_target_name).json',
        'native_libraries': [
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/jni/x86/libPXCACore.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/jni/x86/libPXCADepthUtils.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libcilkrts.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libdepthcore_jni.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libdepthexperience.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libDepthPhotographyCore.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libDepthPhotographyExperiences.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libgnustl_shared.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libopencv_info.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCADepthPhoto/jni/x86/libopencv_java.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/jni/x86/libPXCAPlayback_Camera.so',
        ],
      },
      'includes': [
        '../../common/copy_native_libraries.gypi',
        '../../common/prepare_js_json.gypi',
        '../../common/merge_jars.gypi',
        '../../../../build/java.gypi',
      ],
    },
    {
      'target_name': 'enhanced_photography_sample',
      'type': 'none',
      'dependencies': [
        'enhanced_photography',
      ],
      'variables': {
        'extension_dir': '<(PRODUCT_DIR)/enhanced_photography',
        'source_files': [
          '../../../sample/enhancedphotography.html',
          '../../../sample/enhancedphotography.js',
          '<(extension_dir)/enhanced_photography.jar',
          '<(extension_dir)/enhanced_photography.js',
          '<(extension_dir)/enhanced_photography.json',
        ],
        'target_dir': '<(PRODUCT_DIR)/apks',
        'apk_name': 'EnhancedPhotographySample',
        'package_name': 'org.xwalk.<(_target_name)',
        'extension_path': '<(PRODUCT_DIR)/enhanced_photography',
        'native_library_path': '<(PRODUCT_DIR)/enhanced_photography/jni',
        'arch': 'x86',
        'app_root': '../../../sample',
        'app_local_path': 'enhancedphotography.html',
        'target_file': '<(target_dir)/<(apk_name)_<(arch).apk',
      },
      'includes': [
        '../../common/make_apk.gypi',
      ],
    },
  ],
}
