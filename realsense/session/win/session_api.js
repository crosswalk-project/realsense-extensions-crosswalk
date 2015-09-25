// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var Session = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('sessionConstructor', [this._id]);

  this._addMethodWithPromise('getVersion');
};

Session.prototype = new common.EventTargetPrototype();
Session.prototype.constructor = Session;

exports = Session;
