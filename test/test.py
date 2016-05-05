#!/usr/bin/env python
#
# Copyright (c) 2016 Intel Corporation. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.


import optparse
import os
import subprocess
import sys


def get_xwalk():
    if ("XWALK_HOME" not in os.environ):
        print "Error: 'XWALK_HOME' has not been set to the crosswalk binary."
        sys.exit(2)
    else:
        return os.path.join(
            os.path.splitext(os.path.abspath(os.environ["XWALK_HOME"]))[0],
            "xwalk.exe")

def run_tests():
    xwalk = get_xwalk()
    cmd = "%s manifest.json" % xwalk
    print "Command: " + cmd
    subprocess.Popen(cmd, stdout=subprocess.PIPE, shell=True)

def start_server():
    return subprocess.Popen("rsserver.py", stdout=subprocess.PIPE, shell=True)
    

def main():
    print "Starting server ..."
    p = start_server()
    print "Running tests..."
    run_tests()
    out, err = p.communicate()
    if err:
        print(err)
    else:
        result = out.split("\n")
        for lin in result:
            if not lin.startswith("#"):
                print(lin)
    return


if __name__ == "__main__":
    main()
