// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var ScenePerception = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('scenePerceptionConstructor', [this._id]);

  this._addMethodWithPromise('start', Promise);
  this._addMethodWithPromise('stop', Promise);
  this._addMethodWithPromise('reset', Promise);
  this._addMethodWithPromise('enableTracking', Promise);
  this._addMethodWithPromise('disableTracking', Promise);
  this._addMethodWithPromise('enableMeshing', Promise);
  this._addMethodWithPromise('disableMeshing', Promise);

  this._addEvent('error');
  this._addEvent('checking');
  this._addEvent('tracking');
  this._addEvent('meshing');
};

ScenePerception.prototype = new common.EventTargetPrototype();
ScenePerception.prototype.constructor = ScenePerception;

exports = ScenePerception;
