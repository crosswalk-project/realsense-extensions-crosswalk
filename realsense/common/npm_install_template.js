// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// set var package_name here.

var module_path = 'node_modules/' + package_name;
var xwalk_rs_cmd_line = '--use-rs-video-capture';

console.log('Executing install.js.');

var uninstall = (process.argv[2] === '--uninstall');

var FS = require('fs');
var Path = require('path');

var buffer;
try {
  buffer = FS.readFileSync('../../manifest.json', {'encoding': 'utf8'});
} catch (e) {
  console.log('Error: Failed to read manifest.json.');
  process.exit();
}

var json;
try {
  json = JSON.parse(buffer);
} catch (e) {
  console.log('Error: Failed to parse manifest.json.');
  process.exit();
}

if (typeof json.xwalk_command_line === 'undefined') {
  json.xwalk_command_line = '';
}

var cmdIndex = json.xwalk_command_line.indexOf(xwalk_rs_cmd_line);

var updated = false;

if (cmdIndex === -1 && uninstall === false) {
  console.log('Adding xwalk command line ' + xwalk_rs_cmd_line);
  json.xwalk_command_line += ' ' + xwalk_rs_cmd_line;
  updated = true;
}

if (typeof json.xwalk_extensions === 'undefined') {
  json.xwalk_extensions = [];
}

var extensionIndex = json.xwalk_extensions.indexOf(module_path);

if (extensionIndex === -1 && uninstall === false) {
  console.log('Adding ' + package_name);
  json.xwalk_extensions.push(module_path);
  updated = true;
} else if (extensionIndex > -1 && uninstall === true) {
  console.log('Removing ' + package_name);
  json.xwalk_extensions.splice(extensionIndex, 1);
  updated = true;
}

if (updated) {
  try {
    var buffer = JSON.stringify(json, null, 2);
    FS.writeFileSync('../../manifest.json', buffer);
  } catch (e) {
    console.log('Failed to upate manifest.json.');
    process.exit();
  }
}
