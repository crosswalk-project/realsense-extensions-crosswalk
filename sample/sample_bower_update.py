#!/usr/bin/env python
#
# Copyright (c) 2016 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

''' This script is used to install/update the
    polymer custome elements needed by our sample app.
'''

import os
import subprocess

SAMPLE_SRC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                              'src_polymer')

def main():
  cmd = "npm install -g bower"
  subprocess.check_call(cmd, shell=True)

  cmd = "bower install"
  subprocess.check_call(cmd, cwd=SAMPLE_SRC_DIR, shell=True)

  cmd = "bower update"
  subprocess.check_call(cmd, cwd=SAMPLE_SRC_DIR, shell=True)

if __name__ == '__main__':
  main()
