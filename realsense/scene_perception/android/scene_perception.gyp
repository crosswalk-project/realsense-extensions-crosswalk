# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'includes':[
    '../../common/paths_android.gypi',
  ],
  'targets': [
    {
      'target_name': 'scene_perception',
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
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCASenseManager/classes.jar',
        ],
        'jars_to_merge': [
          '<(jar_dir)/common.jar',
          '<(jar_final_path)',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/classes.jar',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCASenseManager/classes.jar',
        ],
        'merged_jar_path': '<(extension_dir)/<(_target_name).jar',
        'js_files_to_merge': [
            '../../../../xwalk/common/common_api.js',
            '../js/scene_perception_api.js',
        ],
        'js_file': '<(_target_name).js',
        'json_file': '<(_target_name).json',
        'native_libraries': [
                  '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/jni/x86/libPXCACore.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCACore/jni/x86/libPXCADepthUtils.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAPlayback/jni/x86/libPXCAPlayback_Camera.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libc++_shared.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libmetaioTracker.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libOpenCL.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libPXCAScenePerception.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libSafeString.so',
          '../../../build/rssdk/android/intel_realsense_sdk/PXCAScenePerception/jni/x86/libSP_Core.so',
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
      'target_name': 'scene_perception_sample',
      'type': 'none',
      'dependencies': [
        'scene_perception',
      ],
      'variables': {
        'extension_dir': '<(PRODUCT_DIR)/scene_perception',
        'source_files': [
          '../../../sample/sceneperception.html',
          '../../../sample/sceneperception.js',
          '<(extension_dir)/scene_perception.jar',
          '<(extension_dir)/scene_perception.js',
          '<(extension_dir)/scene_perception.json',
        ],
        'target_dir': '<(PRODUCT_DIR)/apks',
        'apk_name': 'ScenePerceptionSample',
        'package_name': 'org.xwalk.<(_target_name)',
        'extension_path': '<(PRODUCT_DIR)/scene_perception',
        'native_library_path': '<(PRODUCT_DIR)/scene_perception/jni',
        'arch': 'x86',
        'app_root': '../../../sample',
        'app_local_path': 'sceneperception.html',
        'target_file': '<(target_dir)/<(apk_name)_<(arch).apk',
      },
      'includes': [
        '../../common/make_apk.gypi',
      ],
    },
  ],
}
