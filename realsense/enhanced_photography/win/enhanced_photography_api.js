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

  this._addMethodWithPromise('queryReferenceImage', null, wrapColorImageReturns);
  this._addMethodWithPromise('queryOriginalImage', null, wrapColorImageReturns);
  this._addMethodWithPromise('queryDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('queryRawDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('setColorImage', wrapColorImageArgs);
  this._addMethodWithPromise('setDepthImage');
  this._addMethodWithPromise('clone', null, wrapPhotoReturns);

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

  function wrapBlobArg(data) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var dataUrl = e.target.result;
        var result = dataUrl.split(',');
        var resultData = [];
        resultData[0] = result[1];
        resolve(resultData);
        };
      reader.readAsDataURL(data[0]);
    });
  }

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

  function wrapRawDataReturns(data) {
    // 1 int32 (4 bytes) value (callback id).
    var dataBuffer = data.slice(4);
    var blob = new Blob([dataBuffer], { type: 'image/jpeg' });
    return blob;
  };

  this._addMethodWithPromise('startPreview');
  this._addMethodWithPromise('stopPreview');
  this._addMethodWithPromise('getPreviewImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('takeSnapShot', null, wrapReturns);
  this._addMethodWithPromise2('loadDepthPhoto', wrapBlobArg, wrapReturns);
  this._addMethodWithPromise('saveDepthPhoto', wrapArgs, wrapRawDataReturns);

  this._addMethodWithPromise('measureDistance', wrapArgs);
  this._addMethodWithPromise('depthRefocus', wrapArgs, wrapReturns);
  this._addMethodWithPromise('depthResize', wrapArgs, wrapReturns);
  this._addMethodWithPromise('enhanceDepth', wrapArgs, wrapReturns);
  this._addMethodWithPromise('pasteOnPlane', wrapImageArgs, wrapReturns);
  this._addMethodWithPromise('computeMaskFromCoordinate', wrapArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('depthBlend', wrapImageArgs, wrapReturns);
  this._addMethodWithPromise('objectSegment', wrapArgs, wrapY8ImageReturns);
  this._addMethodWithPromise('refineMask', null, wrapY8ImageReturns);
  this._addMethodWithPromise('initMotionEffect', wrapArgs);
  this._addMethodWithPromise('applyMotionEffect', null, wrapRGB32ImageReturns);

  this._addEvent('error');
  this._addEvent('preview');
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports = new EnhancedPhotography();
