// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var DepthPhoto = function(object_id) {
  common.BindingObject.call(this, object_id ? object_id : common.getUniqueId());

  if (object_id == undefined)
    internal.postMessage('depthPhotoConstructor', [this._id]);

  function wrapColorImageArgs(args) {
    if (args[0].data instanceof Uint8Array ||
        args[0].data instanceof Uint8ClampedArray) {
      var uint8_array = args[0].data;
      var buffer = Array.prototype.slice.call(uint8_array);
      args[0].data = buffer;
    }
    return args;
  };

  function wrapColorImageReturns(data) {
    var int32_array = new Int32Array(data);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var buffer = new Uint8Array(data, header_byte_offset, width * height * 4);
    return { format: 'RGB32', width: width, height: height, data: buffer };
  };

  function wrapDepthImageReturns(data) {
    var int32_array = new Int32Array(data);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var buffer = new Uint16Array(data, header_byte_offset, width * height);
    return { format: 'DEPTH', width: width, height: height, data: buffer };
  };

  function wrapPhotoReturns(data) {
    return new DepthPhoto(data.objectId);
  };

  this._addMethodWithPromise('queryReferenceImage', Promise, null, wrapColorImageReturns);
  this._addMethodWithPromise('queryOriginalImage', Promise, null, wrapColorImageReturns);
  this._addMethodWithPromise('queryDepthImage', Promise, null, wrapDepthImageReturns);
  this._addMethodWithPromise('queryRawDepthImage', Promise, null, wrapDepthImageReturns);
  this._addMethodWithPromise('setColorImage', Promise, wrapColorImageArgs);
  this._addMethodWithPromise('setDepthImage', Promise);
  this._addMethodWithPromise('clone', Promise, null, wrapPhotoReturns);

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

  function wrapImageArgs(args) {
    args[0] = { objectId: args[0].photoId };
    if ((args[1].data instanceof Uint8Array) ||
        (args[1].data instanceof Uint8ClampedArray)) {
      var uint8_array = args[1].data;
      var buffer = Array.prototype.slice.call(uint8_array);
      args[1].data = buffer;
    }
    return args;
  };

  function wrapReturns(data) {
    return new DepthPhoto(data.objectId);
  };

  function wrapRGB32ImageReturns(data) {
    var int32_array = new Int32Array(data);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var buffer = new Uint8Array(data, header_byte_offset, width * height * 4);
    return { format: 'RGB32', width: width, height: height, data: buffer };
  };

  function wrapF32ImageReturns(data) {
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var int32_array = new Int32Array(data, 0, header_byte_offset);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    var buffer = new Float32Array(data, header_byte_offset, width * height);
    return { format: 'DEPTH_F32', width: width, height: height, data: buffer };
  };

  function wrapY8ImageReturns(data) {
    // 3 int32 (4 bytes) values.
    var header_byte_offset = 3 * 4;
    var int32_array = new Int32Array(data, 0, header_byte_offset);
    // int32_array[0] is the callback id.
    var width = int32_array[1];
    var height = int32_array[2];
    var buffer = new Uint8Array(data, header_byte_offset, width * height);
    return { format: 'Y8', width: width, height: height, data: buffer };
  };

  this._addMethodWithPromise('startPreview', Promise);
  this._addMethodWithPromise('stopPreview', Promise);
  this._addMethodWithPromise('getPreviewImage', Promise, null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('takeSnapShot', Promise, null, wrapReturns);
  this._addMethodWithPromise('loadFromXMP', Promise, null, wrapReturns);
  this._addMethodWithPromise('saveAsXMP', Promise, wrapArgs);

  this._addMethodWithPromise('measureDistance', Promise, wrapArgs);
  this._addMethodWithPromise('depthRefocus', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('depthResize', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('enhanceDepth', Promise, wrapArgs, wrapReturns);
  this._addMethodWithPromise('pasteOnPlane', Promise, wrapImageArgs, wrapReturns);
  this._addMethodWithPromise('computeMaskFromCoordinate', Promise, wrapArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('depthBlend', Promise, wrapImageArgs, wrapReturns);
  this._addMethodWithPromise('objectSegment', Promise, wrapArgs, wrapY8ImageReturns);
  this._addMethodWithPromise('refineMask', Promise, null, wrapY8ImageReturns);

  this._addEvent('error');
  this._addEvent('preview');
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports = new EnhancedPhotography();
