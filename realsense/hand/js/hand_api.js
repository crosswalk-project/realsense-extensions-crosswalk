// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var HandModule = function(objectId) {
  common.BindingObject.call(this, objectId ? objectId : common.getUniqueId());

  this._registerLifecycleTracker();

  if (objectId == undefined)
    internal.postMessage('handModuleConstructor', [this._id]);

  function wrapImageReturns(data) {
    const bytesPerInt32 = 4;
    const PIXEL_FORMAT_DEPTH = 0x00020000;  // enum PixelFormat of pxcimage.h
    const PIXEL_FORMAT_Y8 = 0x00010004;  // enum PixelFormat of pxcimage.h
    var headerByteOffset = 4 * bytesPerInt32;
    var int32View = new Int32Array(data, 0, 4);
    // int32View[0] is the callback id.
    var width = int32View[2];
    var height = int32View[3];
    var format, buffer;
    if (int32View[1] === PIXEL_FORMAT_DEPTH) {
      format = 'depth';
      buffer = new Uint16Array(data, headerByteOffset, width * height);
    } else if (int32View[1] === PIXEL_FORMAT_Y8) {
      format = 'y8';
      buffer = new Uint8Array(data, headerByteOffset, width * height);
    }
    return {format: format, width: width, height: height, data: buffer};
  }

  var handModuleObject = this;
  function wrapHandsReturns(hands) {
    var handObjectArray = [];
    for (var i in hands) {
      var handObject = new Hand(handModuleObject, hands[i]);
      handObjectArray.push(handObject);
    }
    return handObjectArray;
  }

  function wrapErrorReturns(error) {
    return new DOMException(error.message, error.name);
  }

  this._addMethodWithPromise('init', null, null, wrapErrorReturns);
  this._addMethodWithPromise('start', null, null, wrapErrorReturns);
  this._addMethodWithPromise('stop', null, null, wrapErrorReturns);
  this._addMethodWithPromise('track', null, wrapHandsReturns, wrapErrorReturns);
  this._addMethodWithPromise('getDepthImage', null, wrapImageReturns, wrapErrorReturns);

  this._addMethodWithPromise('_getSegmentationImageById', null, wrapImageReturns, wrapErrorReturns);
  this._addMethodWithPromise('_getContoursById', null, null, wrapErrorReturns);
};

var Hand = function(handModule, hand) {
  Object.defineProperties(this, {
    'uniqueId' : {
      value: hand.uniqueId,
    },
    'timeStamp': {
      value: hand.timeStamp,
    },
    'calibrated': {
      value: hand.calibrated,
    },
    'bodySide': {
      value: hand.bodySide,
    },
    'boundingBoxImage': {
      value: hand.boundingBoxImage,
    },
    'massCenterImage': {
      value: hand.massCenterImage,
    },
    'palmOrientation': {
      value: hand.palmOrientation,
    },
    'palmRadiusImage': {
      value: hand.palmRadiusImage,
    },
    'palmRadiusWorld': {
      value: hand.palmRadiusWorld,
    },
    'extremityPoints': {
      value: hand.extremityPoints,
    },
    'fingerData': {
      value: hand.fingerData,
    },
    'trackedJoints': {
      value: hand.trackedJoints,
    },
    'trackingStatus': {
      value: hand.trackingStatus,
    },
    'openness': {
      value: hand.openness,
    },
    'normalizedJoints': {
      value: hand.normalizedJoints,
    }
  });

  function addMethod(handObject, name) {
    Object.defineProperty(handObject, name, {
      value: function() {
        return new Promise(function(resolve, reject) {
          handModule['_' + name + 'ById'](hand.uniqueId).then(
              function(result) {
                resolve(result);
              },
              function(error) {
                reject(error);
              }
          );
        });
      }
    });
  };

  addMethod(this, 'getSegmentationImage');
  addMethod(this, 'getContours');
};

HandModule.prototype = new common.EventTargetPrototype();
HandModule.prototype.constructor = HandModule;
exports.HandModule = HandModule;
