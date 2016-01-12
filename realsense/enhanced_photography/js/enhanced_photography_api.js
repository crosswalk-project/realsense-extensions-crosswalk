// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const bytesPerBool = 1;
const bytesPerFloat = 4;
const bytesPerInt32 = 4;
const bytesPerRGB32Pixel = 4;
const bytesPerDEPTHPixel = 2;
const bytesPerY8Pixel = 1;

function wrapErrorResult(errorCode) {
  return new DEPError(errorCode);
}

function wrapF32ImageReturns(data) {
  // 3 int32 (4 bytes) values.
  var headerByteOffset = 3 * bytesPerInt32;
  var int32Array = new Int32Array(data, 0, 3);
  // int32Array[0] is the callback id.
  var width = int32Array[1];
  var height = int32Array[2];
  var buffer = new Float32Array(data, headerByteOffset, width * height);
  return { format: 'DEPTH_F32', width: width, height: height, data: buffer };
}

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

function wrapDepthImageReturns(data) {
  var int32Array = new Int32Array(data, 0, 3);
  // int32Array[0] is the callback id.
  var width = int32Array[1];
  var height = int32Array[2];
  // 3 int32 (4 bytes) values.
  var headerByteOffset = 3 * bytesPerInt32;
  var buffer = new Uint16Array(data, headerByteOffset, width * height);
  return { format: 'DEPTH', width: width, height: height, data: buffer };
}

var DepthMask = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  if (objectId == undefined)
    internal.postMessage('depthMaskConstructor', [this._id]);

  this._addMethodWithPromise('init', wrapPhotoArgs);
  this._addMethodWithPromise('computeFromCoordinate', null, wrapF32ImageReturns);
  this._addMethodWithPromise('computeFromThreshold', null, wrapF32ImageReturns);
};

DepthMask.prototype = new common.EventTargetPrototype();
DepthMask.prototype.constructor = DepthMask;
exports.DepthMask = DepthMask;

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

  this._addMethodWithPromise('checkSignature');
  this._addMethodWithPromise('queryCameraPerspectiveModel');
  this._addMethodWithPromise('queryCameraPose');
  this._addMethodWithPromise('queryCameraVendorInfo');
  this._addMethodWithPromise('queryContainerImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('queryColorImage', null, wrapRGB32ImageReturns);
  this._addMethodWithPromise('queryDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('queryDeviceVendorInfo');
  this._addMethodWithPromise('queryNumberOfCameras');
  this._addMethodWithPromise('queryRawDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('queryXDMRevision');
  this._addMethodWithPromise('resetContainerImage');
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

var DepthRefocus = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  if (objectId == undefined)
    internal.postMessage('depthRefocusConstructor', [this._id]);

  this._addMethodWithPromise('init', wrapPhotoArgs);
  this._addMethodWithPromise('apply', null, wrapPhotoReturns);
};

DepthRefocus.prototype = new common.EventTargetPrototype();
DepthRefocus.prototype.constructor = DepthRefocus;
exports.DepthRefocus = DepthRefocus;

var DEPError = function(errorCode) {
  var errorMap = {
    '1': { 'error': 'feature-unsupported',
      'message': 'The requested feature is not available or not implemented.' },
    '2': { 'error': 'param-unsupported', 'message': 'There are invalid/unsupported parameters.' },
    '3': { 'error': 'invalid-photo', 'message': 'The Photo object is invalid.' },
    '4': { 'error': 'exec-failed', 'message': 'The operation failed to execute.' }
  };

  function getError(err) {
    return errorMap[err].error;
  };

  function getMessage(err) {
    return errorMap[err].message;
  };

  Object.defineProperties(this, {
    'error': {
      value: getError(errorCode),
      configurable: false,
      writable: false,
      enumerable: true,
    },
  });

  Object.defineProperties(this, {
    'message': {
      value: getMessage(errorCode),
      configurable: false,
      writable: false,
      enumerable: true,
    },
  });
};

var Measurement = function(objectId) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (objectId == undefined)
    internal.postMessage('measurementConstructor', [this._id]);

  this._addMethodWithPromise('measureDistance', wrapPhotoArgs);
  this._addMethodWithPromise('measureUADistance', wrapPhotoArgs);
  this._addMethodWithPromise('queryUADataSize');
  this._addMethodWithPromise('queryUAData');
};

Measurement.prototype = new common.EventTargetPrototype();
Measurement.prototype.constructor = Measurement;
exports.Measurement = Measurement;

var MotionEffect = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  if (objectId == undefined)
    internal.postMessage('motionEffectConstructor', [this._id]);

  this._addMethodWithPromise('init', wrapPhotoArgs, null, wrapErrorResult);
  this._addMethodWithPromise('apply', null, wrapRGB32ImageReturns, wrapErrorResult);
};

MotionEffect.prototype = new common.EventTargetPrototype();
MotionEffect.prototype.constructor = MotionEffect;
exports.MotionEffect = MotionEffect;

var Paster = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  if (objectId == undefined)
    internal.postMessage('pasterConstructor', [this._id]);

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
  this._addMethodWithPromise('setPhoto', wrapPhotoArgs);
  this._addBinaryMethodWithPromise('setSticker', wrapSetStickerArgsToArrayBuffer);
  this._addMethodWithPromise('paste', null, wrapPhotoReturns);
  this._addMethodWithPromise('previewSticker', null, wrapY8ImageReturns);
};

Paster.prototype = new common.EventTargetPrototype();
Paster.prototype.constructor = Paster;
exports.Paster = Paster;

var PhotoCapture = function(previewStream, objectId) {
  if (!((previewStream instanceof webkitMediaStream) ||
      (previewStream instanceof MediaStream)))
    throw 'Argument is not a MediaStream instance';

  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());
  common.EventTarget.call(this);

  var videoTracks = previewStream.getVideoTracks();
  if (videoTracks.length == 0)
    throw 'no valid video track';
  var videoTrack = videoTracks[0];
  if (videoTrack.readyState == 'ended')
    throw 'vdieo track is ended';

  var videoElement = document.createElement('video');
  videoElement.autoplay = true;
  videoElement.srcObject = previewStream;

  var that = this;
  videoTrack.onended = function() {
    that._postMessage('disableDepthStream', []);
  };
  videoElement.onplay = function() {
    that._postMessage('enableDepthStream', [videoTrack.label]);
  };

  Object.defineProperties(this, {
    'previewStream': {
      value: previewStream,
      configurable: false,
      writable: false,
      enumerable: true,
    }
  });

  this._addMethodWithPromise('getDepthImage', null, wrapDepthImageReturns);
  this._addMethodWithPromise('takePhoto', null, wrapPhotoReturns);

  this._addEvent('error');
  this._addEvent('depthquality');

  internal.postMessage('photoCaptureConstructor', [this._id]);
};

PhotoCapture.prototype = new common.EventTargetPrototype();
PhotoCapture.prototype.constructor = PhotoCapture;

exports.PhotoCapture = PhotoCapture;

var PhotoUtils = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (objectId == undefined)
    internal.postMessage('photoUtilsConstructor', [this._id]);

  this._addMethodWithPromise('colorResize', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('commonFOV', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('depthResize', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('enhanceDepth', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('getDepthQuality', wrapPhotoArgs);
  this._addMethodWithPromise('photoCrop', wrapPhotoArgs, wrapPhotoReturns);
  this._addMethodWithPromise('photoRotate', wrapPhotoArgs, wrapPhotoReturns);
};

PhotoUtils.prototype = new common.EventTargetPrototype();
PhotoUtils.prototype.constructor = PhotoUtils;
exports.PhotoUtils = new PhotoUtils();

var Segmentation = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (objectId == undefined)
    internal.postMessage('segmentationConstructor', [this._id]);

  function wrapObjectSegmentArgsToArrayBuffer(args) {
    var photoId = args[0].photoId;
    var alignedPhotoIdLen = photoId.length + 4 - photoId.length % 4;
    var y8Image = args[1];
    if (y8Image.format != 'Y8')
      return null;
    // photoIdLen(int), photoId(string), image[imageWidth(int) imageHeight(int) imageData]
    var length = bytesPerInt32 + alignedPhotoIdLen +
        2 * bytesPerInt32 + y8Image.width * y8Image.height * bytesPerY8Pixel;
    var arrayBuffer = new ArrayBuffer(length);
    var offset = 0;
    var view = new Int32Array(arrayBuffer, offset, 1);
    view[0] = photoId.length;
    offset += bytesPerInt32;

    view = new Uint8Array(arrayBuffer, offset, photoId.length);
    for (var i = 0; i < photoId.length; i++) {
      view[i] = photoId.charCodeAt(i);
    }
    offset += alignedPhotoIdLen;

    view = new Int32Array(arrayBuffer, offset, 2);
    view[0] = y8Image.width;
    view[1] = y8Image.height;
    offset += bytesPerInt32 * 2;

    view = new Uint8Array(arrayBuffer, offset);
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

  this._addBinaryMethodWithPromise('objectSegment',
                                   wrapObjectSegmentArgsToArrayBuffer,
                                   wrapY8ImageReturns);
  this._addMethodWithPromise('redo', null, wrapY8ImageReturns);
  this._addBinaryMethodWithPromise('refineMask', wrapRefineMaskToArrayBuffer, wrapY8ImageReturns);
  this._addMethodWithPromise('undo', null, wrapY8ImageReturns);
};

Segmentation.prototype = new common.EventTargetPrototype();
Segmentation.prototype.constructor = Segmentation;
exports.Segmentation = Segmentation;

var XDMUtils = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  if (objectId == undefined)
    internal.postMessage('XDMUtilsConstructor', [this._id]);

  function wrapBlobArgs(data) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var buffer = e.target.result;
        resolve(buffer);
      };
      reader.readAsArrayBuffer(data[0]);
    });
  };

  function wrapBlobReturns(data) {
    // 1 int32 (4 bytes) value (callback id).
    var dataBuffer = data.slice(4);
    var blob = new Blob([dataBuffer], { type: 'image/jpeg' });
    return blob;
  };

  this._addBinaryMethodWithPromise2('isXDM', wrapBlobArgs);
  this._addBinaryMethodWithPromise2('loadXDM', wrapBlobArgs, wrapPhotoReturns);
  this._addMethodWithPromise('saveXDM', wrapPhotoArgs, wrapBlobReturns);
};

XDMUtils.prototype = new common.EventTargetPrototype();
XDMUtils.prototype.constructor = XDMUtils;
exports.XDMUtils = new XDMUtils();
