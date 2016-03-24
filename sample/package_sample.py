#!/usr/bin/env python
#
# Copyright (c) 2016 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

''' This script is used to generate extension hooks
    for each module from the template js hooks.
'''

import json
import optparse
import os
import shutil
import subprocess
import sys


def getAppToolsVersion():
  cmd = "crosswalk-pkg --version"
  version = subprocess.Popen(cmd, shell=True,
                             stdout=subprocess.PIPE).stdout.read()
  return version


def addAppVersion(version, app_root):
  key = "xwalk_app_version"
  m_path = os.path.join(app_root, "manifest.json")
  manifest = json.loads(open(m_path, 'r').read())
  manifest[key] = version
  open(m_path, 'w').write(json.dumps(manifest))


def packageSampleApp(appRoot, platform, xwalkPath):
  cmd = "crosswalk-pkg -p %s -c %s %s" % (platform, xwalkPath, appRoot)
  print "cmd:" + cmd
  subprocess.Popen(cmd, shell=True)


def main():
  parser = optparse.OptionParser()
  parser.add_option('-e', '--extensions', help='Directory to the extensions')
  parser.add_option('-w', '--web_content', help='Directory to the web staff.')
  parser.add_option('-o', '--out', help='Output directory of the sample app.')
  parser.add_option('-p', '--platform',
                    help='The target platform for the sample.')
  parser.add_option('-v', '--version', help='The application version.')

  (options, _) = parser.parse_args()
  if not os.path.isdir(options.extensions):
    print "Error: no extensions in " + options.extensions
    sys.exit(2)
  if not os.path.isdir(options.web_content):
    print "Error: no web staff in " + options.web_content
    sys.exit(2)

  # Clean the output directory.
  if os.path.exists(options.out):
    print "Warning: out directory " + options.out + " already exists."
    shutil.rmtree(options.out)

  # Copy web content to the sample app folder.
  shutil.copytree(options.web_content, options.out)

  # Copy extensions to the sample app folder.
  distExtDir = os.path.join(options.out, "realsense_extensions")
  if os.path.exists(distExtDir):
    print "Error: dist extensions directory " + distExtDir + " already exists."
    sys.exit(2)
  shutil.copytree(options.extensions, distExtDir)

  # Add currently VERSION to the manifest.json.
  if options.version is not None:
    addAppVersion(options.version, options.out)

  # Package the sample app using app-tools.
  version = getAppToolsVersion()
  if version is None:
    print "Error: Crosswalk-App-tools not found."
    sys.exit(2)

  xwalkEnv = "XWALK_HOME"
  if (xwalkEnv not in os.environ):
    print "Error: 'XWALK_HOME' has not been set to the crosswalk binary."
    sys.exit(2)

  # Currently we specified the platfrom as "windows".
  packageSampleApp(options.out,
                   options.platform,
                   os.path.abspath(os.environ[xwalkEnv]))


if __name__ == '__main__':
  main()
