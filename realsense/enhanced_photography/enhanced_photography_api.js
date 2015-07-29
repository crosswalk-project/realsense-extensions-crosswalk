// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var DepthPhoto = function(object_id) {
  common.BindingObject.call(this, object_id ? object_id : common.getUniqueId());

  if (object_id == undefined)
    internal.postMessage('depthPhotoConstructor', [this._id]);

  this._addMethodWithPromise('getColorImage', Promise);
  this._addMethodWithPromise('getDepthImage', Promise);
  this._addMethodWithPromise('setColorImage', Promise);
  this._addMethodWithPromise('setDepthImage', Promise);

  Object.defineProperties(this, {
    'photoId': {
      value: object_id,
      enumerable: true,
    },
  });
};

DepthPhoto.prototype = new common.EventTargetPrototype();
DepthPhoto.prototype.constructor = DepthPhoto;

var EnhancedPhotography = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('enhancedPhotographyConstructor', [this._id]);

  function wrapArgs(data) {
    data[0] = { objectId: data[0].photoId };
    return data;
  };

  function wrapReturns(data) {
    return new DepthPhoto(data.objectId);
  };

  function wrapImageReturns(data) {
    var int32_array = new Int32Array(data);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var buffer = new Uint8Array(data, header_byte_offset, width * height * 4);
    return {width: width, height: height, data: buffer};
  };

  this._addMethodWithPromise('startPreview', Promise);
  this._addMethodWithPromise('stopPreview', Promise);
  this._addMethodWithPromise('getPreviewImage', Promise, null, wrapImageReturns);
  this._addMethodWithPromise('takeSnapShot', Promise, null, wrapReturns);
  this._addMethodWithPromise('loadFromXMP', Promise, null, wrapReturns);
  this._addMethodWithPromise('saveAsXMP', Promise, wrapArgs);


  this._addMethodWithPromise('measureDistance', Promise, wrapArgs);
  this._addMethodWithPromise('depthRefocus', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('depthResize', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('enhanceDepth', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('pasteOnPlane', Promise, wrapArgs, wrapReturns);

  this._addEvent('error');
  this._addEvent('preview');
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports = new EnhancedPhotography();
