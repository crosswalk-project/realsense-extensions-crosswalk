#!/usr/bin/env python
# Copyright (c) 2016 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

''' This script is used to generate extension hooks
    for each module from the template js hooks.
'''

import argparse
import os
import sys
import shutil

SCRIPT_DIR = os.path.dirname(__file__)
DEFAULT_TEMPLATE = os.path.join(SCRIPT_DIR, "XWalkExtensionHooks_template.js")
MOUDLE_MAP = {
    "enhanced_photography.dll": "RS_R200_DEP",
    "scene_perception.dll": "RS_R200_SP",
    "face.dll": "RS_R200_Face"
}


def main():
  parser = argparse.ArgumentParser()
  parser.add_argument('--extension-dll',
                      help='The extension dll file.')
  parser.add_argument('--target-dir',
                      help='Target directory of with .dll and hook file.')

  args = parser.parse_args()

  if not os.path.isfile(args.extension_dll):
    print "Error: %s is not a file." % args.extension_dll
    sys.exit(2)

  dll_file = os.path.basename(args.extension_dll)
  if not (dll_file in MOUDLE_MAP.keys()):
    print "Error: can't found the module name for dll - " % args.extension_dll
    sys.exit(3)

  shutil.copyfile(args.extension_dll,
                  os.path.join(args.target_dir, dll_file))

  hooks_file = os.path.join(args.target_dir, "XWalkExtensionHooks.js")
  # Add extra line in the template js hooks to make the module hooks.
  open(hooks_file, 'w').write('var MODULE_NAME = "' +
                              MOUDLE_MAP[dll_file] + '";')
  open(hooks_file, 'a').write(open(DEFAULT_TEMPLATE, 'r').read())


if __name__ == '__main__':
  sys.exit()
