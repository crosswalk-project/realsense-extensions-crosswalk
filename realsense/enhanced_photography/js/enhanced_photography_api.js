// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const bytesPerInt32 = 4;
const bytesPerRGB32Pixel = 4;
const bytesPerDEPTHPixel = 2;
const bytesPerY8Pixel = 1;

function wrapRGB32ImageReturns(data) {
  var int32Array = new Int32Array(data, 0, 3);
  // int32Array[0] is the callback id.
  var width = int32Array[1];
  var height = int32Array[2];
  // 3 int32 (4 bytes) values.
  var headerByteOffset = 3 * bytesPerInt32;
  var buffer = new Uint8Array(data, headerByteOffset, width * height * bytesPerRGB32Pixel);
  return { format: 'RGB32', width: width, height: height, data: buffer };
}

var DepthPhoto = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (objectId == undefined)
    internal.postMessage('depthPhotoConstructor', [this._id]);

  function wrapRGB32ImageArgs(args) {
    if (args[0].format != 'RGB32')
      return null;
    var length = 2 * bytesPerInt32 + args[0].width * args[0].height * bytesPerRGB32Pixel;
    var arrayBuffer = new ArrayBuffer(length);
    var view = new Int32Array(arrayBuffer, 0, 2);
    view[0] = args[0].width;
    view[1] = args[0].height;
    var view = new Uint8Array(arrayBuffer, 2 * bytesPerInt32);
    for (var i = 0; i < args[0].data.length; i++) {
      view[i] = args[0].data[i];
    }
    return arrayBuffer;
  };

  function wrapDepthImageArgs(args) {
    if (args[0].format != 'DEPTH')
      return null;
    var length = 2 * bytesPerInt32 + args[0].width * args[0].height * bytesPerDEPTHPixel;
    var arrayBuffer = new ArrayBuffer(length);
    var view = new Int32Array(arrayBuffer, 0, 2);
    view[0] = args[0].width;
    view[1] = args[0].height;
    var view = new Uint16Array(arrayBuffer, 2 * bytesPerInt32);
    for (var i = 0; i < args[0].data.length; i++) {
      view[i] = args[0].data[i];
    }
    return arrayBuffer;
  };

  function wrapDepthImageReturns(data) {
    var int32Array = new Int32Array(data, 0, 3);
    // int32Array[0] is the callback id.
    var width = int32Array[1];
    var height = int32Array[2];
    // 3 int32 (4 bytes) values.
    var headerByteOffset = 3 * bytesPerInt32;
    var buffer = new Uint16Array(data, headerByteOffset, width * height);
    return { format: 'DEPTH', width: width, height: height, data: buffer };
  };

  function wrapPhotoReturns(data) {
    return new DepthPhoto(data.objectId);
  };

  function wrapBlobArg(data) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var buffer = e.target.result;
        resolve(buffer);
      };
      reader.readAsArrayBuffer(data[0]);
    });
  }

  function wrapRawDataReturns(data) {
    // 1 int32 (4 bytes) value (callback id).
    var dataBuffer = data.slice(4);
    var blob = new Blob([dataBuffer], { type: 'image/jpeg' });
    return blob;
  };

  this._addBinaryMethodWithPromise2('loadXDM', wrapBlobArg);
  this._addMethodWithPromise('saveXDM', null, wrapRawDataReturns);
  this._addMethodWithPromise('queryContainerImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('queryColorImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('queryDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('queryRawDepthImage', null, wrapDepthImageReturns);
  this._addBinaryMethodWithPromise('setContainerImage', wrapRGB32ImageArgs);
  this._addBinaryMethodWithPromise('setColorImage', wrapRGB32ImageArgs);
  this._addBinaryMethodWithPromise('setDepthImage', wrapDepthImageArgs);
  this._addBinaryMethodWithPromise('setRawDepthImage', wrapDepthImageArgs);
  this._addMethodWithPromise('clone', null, wrapPhotoReturns);

  Object.defineProperties(this, {
    'photoId': {
      value: objectId ? objectId : this._id,
      enumerable: true,
    },
  });
};

DepthPhoto.prototype = new common.EventTargetPrototype();
DepthPhoto.prototype.constructor = DepthPhoto;
exports.DepthPhoto = DepthPhoto;

var EnhancedPhotography = function(objectId) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (objectId == undefined)
    internal.postMessage('enhancedPhotographyConstructor', [this._id]);

  function wrapArgs(data) {
    data[0] = { objectId: data[0].photoId };
    return data;
  };

  function wrapReturns(data) {
    return new DepthPhoto(data.objectId);
  };

  function wrapF32ImageReturns(data) {
    // 3 int32 (4 bytes) values.
    var headerByteOffset = 3 * bytesPerInt32;
    var int32Array = new Int32Array(data, 0, 3);
    // int32Array[0] is the callback id.
    var width = int32Array[1];
    var height = int32Array[2];
    var buffer = new Float32Array(data, headerByteOffset, width * height);
    return { format: 'DEPTH_F32', width: width, height: height, data: buffer };
  };

  this._addMethodWithPromise('startPreview');
  this._addMethodWithPromise('stopPreview');
  this._addMethodWithPromise('getPreviewImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('takePhoto', null, wrapReturns);

  this._addMethodWithPromise('measureDistance', wrapArgs);
  this._addMethodWithPromise('depthRefocus', wrapArgs, wrapReturns);
  this._addMethodWithPromise('computeMaskFromCoordinate', wrapArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('computeMaskFromThreshold', wrapArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('initMotionEffect', wrapArgs);
  this._addMethodWithPromise('applyMotionEffect', null, wrapRGB32ImageReturns);

  this._addEvent('error');
  this._addEvent('preview');
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports.EnhancedPhoto = new EnhancedPhotography();
