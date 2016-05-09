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

APP_TOOL_CMD = 'crosswalk-pkg'
NPM_CMD = 'npm'
VULCANIZE_CMD = 'vulcanize'


def isProgAvailable(program):
  for path in os.environ['PATH'].split(os.pathsep):
    path = path.strip('"')
    exe_file = os.path.join(path, program)
    if os.path.isfile(exe_file) and os.access(exe_file, os.X_OK):
      return exe_file

  return None


def addAppVersion(version, app_root):
  key = "xwalk_app_version"
  m_path = os.path.join(app_root, "manifest.json")
  manifest = json.loads(open(m_path, 'r').read())
  manifest[key] = version
  open(m_path, 'w').write(json.dumps(manifest))


def packageSampleApp(appRoot, platform, xwalkPath):
  cmd = APP_TOOL_CMD + ' -p %s -c %s %s' % (platform, xwalkPath, appRoot)
  print "cmd:" + cmd
  subprocess.Popen(cmd, shell=True)


def npmInstallExtensions(appRoot, distPath):
  nodeModulesPath = os.path.join(appRoot, "node_modules")
  if os.path.exists(nodeModulesPath):
    print "Warning: directory " + nodeModulesPath + " already exists."
    shutil.rmtree(nodeModulesPath)
  os.makedirs(nodeModulesPath)
  manifestPath = os.path.join(appRoot, 'manifest.json')
  manifest = json.loads(open(manifestPath, 'r').read())
  xwalkExtensions = manifest['xwalk_extensions']
  for extension in xwalkExtensions:
    extensionDir = extension.split('/')[1]
    extensionPath = os.path.join(distPath, extensionDir)
    cmd = NPM_CMD + ' install ' + extensionPath
    print "cmd: " + cmd
    process = subprocess.Popen(cmd, shell=True, cwd=appRoot)
    process.wait()


def doVulcanize(appRoot):
  # Install vulcanize if not available
  if isProgAvailable(VULCANIZE_CMD) is None:
    cmd = NPM_CMD + ' install -g ' + VULCANIZE_CMD
    subprocess.check_call(cmd, shell=True)

  cmd = VULCANIZE_CMD + ' ' \
       + os.path.join("elements", "elements.html") \
       + ' --inline-scripts --inline-css --out-html elements.vulcanized.html'
  print "cmd: " + cmd
  process = subprocess.Popen(cmd, shell=True, cwd=appRoot)
  process.wait()

  # All bellowing things have been vulcanized into elements.vulcanized.html.
  shutil.rmtree(os.path.join(appRoot, "elements"))
  shutil.rmtree(os.path.join(appRoot, "bower_components"))
  shutil.rmtree(os.path.join(appRoot, "common"))
  shutil.rmtree(os.path.join(appRoot, "libs"))
  shutil.rmtree(os.path.join(appRoot, "styles"))

  # Remove useless files.
  os.remove(os.path.join(appRoot, "bower.json"))

  # Use vulcanized elements.html instead.
  os.makedirs(os.path.join(appRoot, "elements"))
  os.rename(os.path.join(appRoot, "elements.vulcanized.html"),
              os.path.join(appRoot, "elements", "elements.html"))

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

  # Install app-tool if not available
  if isProgAvailable(APP_TOOL_CMD) is None:
    cmd = "npm install -g crosswalk-app-tools"
    subprocess.check_call(cmd, shell=True)

  # Clean the output directory.
  if os.path.exists(options.out):
    print "Warning: out directory " + options.out + " already exists."
    shutil.rmtree(options.out)

  # Copy web content to the sample app folder.
  shutil.copytree(options.web_content, options.out)

  # If polymer sample, do vulcanize.
  if options.out.endswith("org.xwalk.rs_sample_polymer"):
    doVulcanize(options.out)

  # Install extensions by npm.
  npmInstallExtensions(options.out, options.extensions)

  # Add currently VERSION to the manifest.json.
  if options.version is not None:
    addAppVersion(options.version, options.out)

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
