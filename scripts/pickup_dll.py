#!/usr/bin/env python

''' This script is used to generate extension hooks
    for each module from the template js hooks.
'''

import os
import sys
import shutil

def genHooks(module, outDir):
  templateFile = os.path.join(os.path.dirname(__file__),
                 "XWalkExtensionHooks_template.js")
  hooksFile = os.path.join(outDir, "XWalkExtensionHooks.js")

  #add extra line in the template js hooks to make the module hooks.
  extraLine = 'var MODULE_NAME = "' + module + '";'
  open(hooksFile, 'w').write(extraLine)
  templateContent = open(templateFile, 'r').read()
  open(hooksFile, 'a').write(templateContent)

def main(argv):
  sourceDll = os.path.abspath(argv[1])
  distDll = os.path.abspath(argv[2])
  distDir = os.path.dirname(distDll);
  if not os.path.isfile(sourceDll):
    print "Error: dll path" + sourceDll + " is not a file."
    sys.exit(2)
  if not os.path.isdir(distDir):
    print "Warning: Creating directory - " + distDir;

  fileName = os.path.basename(sourceDll)
  ModuleMap = {
    "enhanced_photography.dll": "RS_R200_DEP",
    "scene_perception.dll": "RS_R200_SP",
    "face.dll": "RS_R200_Face"
  }
  shutil.copyfile(sourceDll, distDll)
  if (fileName in ModuleMap.keys()):
    genHooks(ModuleMap[fileName], distDir);
  else:
    print "Error: can't found the module name for dll - " + fileName
    sys.exit(2)

if __name__ == '__main__':
  sys.exit(main(sys.argv))

