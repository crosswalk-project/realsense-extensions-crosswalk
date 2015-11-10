#!/usr/bin/env python
#
# Copyright 2014 The Chromium Authors. All rights reserved.
# Copyright (c) 2015 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""Tool to download and extract RealSense SDK.
"""

import glob
import os
import shutil
import subprocess
import sys
import tempfile
import urllib

RSSDK_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                         'android')
RSSDK_FILE = 'intel_realsense_android.zip'
RSSDK_OUT = 'intel_realsense_sdk'


def ReadFile(filename):
  with file(filename, 'r') as f:
    return f.read().strip()


def WriteFile(filename, content):
  assert not os.path.exists(filename)
  with file(filename, 'w') as f:
    f.write(content)
    f.write('\n')


def DownloadFromURL(url, dest):
  urllib.urlretrieve(url, dest)


def Unzip(zipfile, destdir):
  FNULL = open(os.devnull, 'w')
  subprocess.check_call(['unzip', zipfile], cwd=destdir, stdout=FNULL)


def ExtractSdk(zipfile, destdir):
  tmpdir = tempfile.mkdtemp(prefix='rssdk_unzip_')

  # intel_realsense_sdk.zip reside in intel_realsense_android.zip,
  # so unzip twice
  Unzip(zipfile, tmpdir)
  Unzip(os.path.join(tmpdir, RSSDK_OUT + '.zip'), tmpdir)

  aarlist = glob.glob(os.path.join(tmpdir, RSSDK_OUT, 'libs', '*.aar'))
  for aarfile in aarlist:
    print('Extracting ' + aarfile)
    aardir = os.path.splitext(os.path.basename(aarfile))[0]

    targetdir = os.path.join(destdir, aardir)
    os.makedirs(targetdir)
    Unzip(aarfile, targetdir)

  shutil.rmtree(tmpdir)


def main(args):
  if not sys.platform.startswith('linux'):
    return 0

  zipfile = os.path.join(RSSDK_DIR, RSSDK_FILE)
  sha1file = zipfile + '.sha1'
  stampfile = zipfile + '.stamp'
  outdir = os.path.join(RSSDK_DIR, RSSDK_OUT)

  checksum = ReadFile(sha1file)

  if os.path.exists(stampfile):
    if (os.path.exists(zipfile) and
        os.path.exists(outdir) and
        checksum == ReadFile(stampfile)):
      return 0
    else:
      os.unlink(stampfile)

  # create outdir if not exists
  if os.path.exists(outdir):
    shutil.rmtree(outdir)
  assert not os.path.exists(outdir)
  os.makedirs(outdir)
  assert os.path.exists(outdir)

  url = ReadFile(zipfile + '.url')
  print('Downloading ' + url)
  DownloadFromURL(url, zipfile)
  assert os.path.exists(zipfile)

  ExtractSdk(zipfile, outdir)
  WriteFile(stampfile, checksum)

  print('Done!')
  return 0


if __name__ == '__main__':
  sys.exit(main(sys.argv[1:]))
