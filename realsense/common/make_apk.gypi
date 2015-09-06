# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

{
  'actions': [
    {
      'action_name': 'make_apk_<(_target_name)',
      'message': 'Creating <(_target_name) APK',
      'inputs': [
        '<(make_apk_path)',
        '>@(source_files)',
      ],
      'outputs': [
        '<(target_file)',
      ],
      'action': [
        'python', '<(make_apk_path)',
        '--name=<(apk_name)',
        '--package=<(package_name)',
        '--extensions=<(extension_path)',
        '--arch=<(arch)',
        '--app-root=<(app_root)',
        '--app-local-path=<(app_local_path)',
        '--target-dir=<(target_dir)',
        '--enable-remote-debugging',
      ],
    },
  ],
}
