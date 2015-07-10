// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var EnhancedPhotography = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('enhancedPhotographyConstructor', [this._id]);

  this._addMethodWithPromise('startPreview', Promise);
  this._addMethodWithPromise('stopPreview', Promise);
  this._addMethodWithPromise('getPreviewImage', Promise);
  this._addMethodWithPromise('takeSnapShot', Promise);
  this._addMethodWithPromise('loadFromXMP', Promise);
  this._addMethodWithPromise('saveAsXMP', Promise);


  this._addMethodWithPromise('measureDistance', Promise);

  this._addEvent('error');
  this._addEvent('image');
  this._addEvent('preview');
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports = EnhancedPhotography;
