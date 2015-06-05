// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

(function() {
  function Session() {
    this.getVersion = function() {
      var msg = {};
      msg.cmd = 'getVersion';
      var serialized = JSON.stringify(msg);
      var response = extension.internal.sendSyncMessage(serialized);
      return JSON.parse(response);
    };
  }

  exports = new Session();
})();
