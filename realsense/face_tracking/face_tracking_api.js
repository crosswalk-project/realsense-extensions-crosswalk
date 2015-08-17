// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var FaceTracking = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('faceTrackingConstructor', [this._id]);

  this._addMethodWithPromise('start', Promise);
  this._addMethodWithPromise('stop', Promise);
  this._addMethodWithPromise('getProcessedSample', Promise);

  this._addEvent('error');
  this._addEvent('processedsample');
};

FaceTracking.prototype = new common.EventTargetPrototype();
FaceTracking.prototype.constructor = FaceTracking;

exports = new FaceTracking();
