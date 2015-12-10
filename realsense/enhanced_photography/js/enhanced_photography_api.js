// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const bytesPerBool = 1;
const bytesPerFloat = 4;
const bytesPerInt32 = 4;
const bytesPerRGB32Pixel = 4;
const bytesPerDEPTHPixel = 2;
const bytesPerY8Pixel = 1;

function wrapPhotoArgs(data) {
  data[0] = { objectId: data[0].photoId };
  return data;
}

function wrapPhotoReturns(data) {
  return new DepthPhoto(data.objectId);
}

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

function wrapY8ImageReturns(data) {
  // 3 int32 (4 bytes) values.
  var header_byte_offset = 3 * 4;
  var int32_array = new Int32Array(data, 0, 3);
  // int32_array[0] is the callback id.
  var width = int32_array[1];
  var height = int32_array[2];
  var buffer = new Uint8Array(data, header_byte_offset, width * height);
  return { format: 'Y8', width: width, height: height, data: buffer };
}

function InvalidPhotoException(message) {
  this.message = message;
  this.name = 'InvalidPhotoException';
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
exports.Photo = DepthPhoto;

var EnhancedPhotography = function(objectId) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (objectId == undefined)
    internal.postMessage('enhancedPhotographyConstructor', [this._id]);

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

  this._addMethodWithPromise('measureDistance', wrapPhotoArgs);
  this._addMethodWithPromise('depthRefocus', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('computeMaskFromCoordinate', wrapPhotoArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('computeMaskFromThreshold', wrapPhotoArgs, wrapF32ImageReturns);
  this._addMethodWithPromise('initMotionEffect', wrapPhotoArgs);
  this._addMethodWithPromise('applyMotionEffect', null, wrapRGB32ImageReturns);
};

EnhancedPhotography.prototype = new common.EventTargetPrototype();
EnhancedPhotography.prototype.constructor = EnhancedPhotography;

exports.EnhancedPhoto = new EnhancedPhotography();

var Paster = function(photo, objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  if (!(photo instanceof DepthPhoto))
    throw new InvalidPhotoException('Invalid Photo object');
  if (objectId == undefined) {
    var result = internal.sendSyncMessage('pasterConstructor', [this._id, { objectId: photo.photoId }]);
    if (!result)
      throw new InvalidPhotoException('Invalid Photo object');
  }

  function wrapSetStickerArgsToArrayBuffer(args) {
    var sticker = args[0];
    var coordinates = args[1];
    var params = args[2];
    var effects = args[3];
    var hasEffects = true;
    if (!effects)
      hasEffects = false;

    if (sticker.format != 'RGB32')
      return null;

    var length;
    // This is for offset alignment
    const twoBytesPadding = 2;
    // length: sticker[imageWidth(int) imageHeight(int) imageData], coordinates[x(int), y(int)],
    // params[height(float), rotation(float), isCenter(bool)], hasEffects(bool)
    // (optional)effects[matchIllumination(bool), transparency(float), embossHighFreqPass(float),
    // shadingCorrection(bool), colorCorrection(bool)]
    if (hasEffects)
      length = bytesPerInt32 * 2 + sticker.data.length + bytesPerInt32 * 2 + bytesPerFloat * 2 +
          bytesPerBool * 2 + twoBytesPadding + bytesPerFloat * 2 + bytesPerBool * 3;
    else
      length = bytesPerInt32 * 2 + sticker.data.length + bytesPerInt32 * 2 +
          bytesPerFloat * 2 + bytesPerBool * 2;

    var arrayBuffer = new ArrayBuffer(length);
    var offset = 0;
    var view = new Int32Array(arrayBuffer, offset, 2);
    view[0] = sticker.width;
    view[1] = sticker.height;
    offset += bytesPerInt32 * 2;

    view = new Uint8Array(arrayBuffer, offset, sticker.data.length);
    for (var i = 0; i < sticker.data.length; i++) {
      view[i] = sticker.data[i];
    }
    offset += sticker.data.length;

    view = new Int32Array(arrayBuffer, offset, 2);
    view[0] = coordinates.x;
    view[1] = coordinates.y;
    offset += bytesPerInt32 * 2;

    view = new Float32Array(arrayBuffer, offset, 2);
    view[0] = params.height;
    view[1] = params.rotation;
    offset += bytesPerFloat * 2;

    view = new Uint8Array(arrayBuffer, offset, 2);
    view[0] = params.isCenter;
    view[1] = hasEffects;
    offset += bytesPerBool * 2 + twoBytesPadding;

    if (hasEffects) {
      view = new Float32Array(arrayBuffer, offset, 2);
      view[0] = effects.transparency;
      view[1] = effects.embossHighFreqPass;
      offset += bytesPerFloat * 2;

      view = new Uint8Array(arrayBuffer, offset, 3);
      view[0] = effects.matchIllumination;
      view[1] = effects.shadingCorrection;
      view[2] = effects.colorCorrection;
    }

    return arrayBuffer;
  };

  this._addMethodWithPromise('getPlanesMap', null, wrapY8ImageReturns);
  this._addBinaryMethodWithPromise('setSticker', wrapSetStickerArgsToArrayBuffer);
  this._addMethodWithPromise('paste', null, wrapPhotoReturns);
  this._addMethodWithPromise('previewSticker', null, wrapY8ImageReturns);

  Object.defineProperties(this, {
    'photo': {
      value: photo,
      configurable: false,
      writable: false,
      enumerable: true,
    },
  });
};

Paster.prototype = new common.EventTargetPrototype();
Paster.prototype.constructor = Paster;
exports.Paster = Paster;

var PhotoCapture = function() {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  internal.postMessage('photoCaptureConstructor', [this._id]);

  this._addMethodWithPromise('startPreview');
  this._addMethodWithPromise('stopPreview');
  this._addMethodWithPromise('getPreviewImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('takePhoto', null, wrapPhotoReturns);

  this._addEvent('error');
  this._addEvent('preview');
};

PhotoCapture.prototype = new common.EventTargetPrototype();
PhotoCapture.prototype.constructor = PhotoCapture;

exports.PhotoCapture = new PhotoCapture();

var PhotoUtils = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (objectId == undefined)
    internal.postMessage('photoUtilsConstructor', [this._id]);

  this._addMethodWithPromise('depthResize', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('enhanceDepth', wrapPhotoArgs, wrapPhotoReturns);
};

PhotoUtils.prototype = new common.EventTargetPrototype();
PhotoUtils.prototype.constructor = PhotoUtils;
exports.PhotoUtils = new PhotoUtils();

var Segmentation = function(photo, objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (!(photo instanceof DepthPhoto))
    throw new InvalidPhotoException('Invalid Photo object');

  if (objectId == undefined) {
    var result = internal.sendSyncMessage(
        'segmentationConstructor', [this._id, { objectId: photo.photoId }]);
    if (!result)
      throw new InvalidPhotoException('Invalid Photo object');
  }

  function wrapY8ImageToArrayBuffer(args) {
    var y8Image = args[0];
    if (y8Image.format != 'Y8')
      return null;
    var length = 2 * bytesPerInt32 + y8Image.width * y8Image.height * bytesPerY8Pixel;
    var arrayBuffer = new ArrayBuffer(length);
    var view = new Int32Array(arrayBuffer, 0, 2);
    view[0] = y8Image.width;
    view[1] = y8Image.height;
    var view = new Uint8Array(arrayBuffer, 2 * bytesPerInt32);
    for (var i = 0; i < y8Image.data.length; i++) {
      view[i] = y8Image.data[i];
    }
    return arrayBuffer;
  };

  function wrapRefineMaskToArrayBuffer(args) {
    var points = args[0];
    var foreground = args[1];
    // length = pointsNumber + pointsData + foreground
    var length = bytesPerInt32 + points.length * bytesPerInt32 * 2 + 1;
    var arrayBuffer = new ArrayBuffer(length);
    var view = new Int32Array(arrayBuffer, 0, points.length * 2 + 1);
    view[0] = points.length;
    var k = 1;
    for (var i = 0; i < points.length; i++) {
      view[k] = points[i].x;
      k++;
      view[k] = points[i].y;
      k++;
    }

    view = new Uint8Array(arrayBuffer, bytesPerInt32 + points.length * bytesPerInt32 * 2);
    view[0] = foreground;

    return arrayBuffer;
  };

  this._addBinaryMethodWithPromise('objectSegment', wrapY8ImageToArrayBuffer, wrapY8ImageReturns);
  this._addMethodWithPromise('redo', null, wrapY8ImageReturns);
  this._addBinaryMethodWithPromise('refineMask', wrapRefineMaskToArrayBuffer, wrapY8ImageReturns);
  this._addMethodWithPromise('undo', null, wrapY8ImageReturns);

  Object.defineProperties(this, {
    'photo': {
      value: photo,
      configurable: false,
      writable: false,
      enumerable: true,
    },
  });
};

Segmentation.prototype = new common.EventTargetPrototype();
Segmentation.prototype.constructor = Segmentation;
exports.Segmentation = Segmentation;
