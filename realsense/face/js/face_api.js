// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var FaceConfiguration = function(faceModuleObjId) {
  common.BindingObject.call(this, faceModuleObjId);

  this._addMethodWithPromise('set');
  this._addMethodWithPromise('getDefaults');
  this._addMethodWithPromise('get');
};
FaceConfiguration.prototype = new common.BindingObjectPrototype();
FaceConfiguration.prototype.constructor = FaceConfiguration;

var Recognition = function(faceModuleObjId) {
  common.BindingObject.call(this, faceModuleObjId);

  this._addMethodWithPromise('registerUserByFaceID');
  this._addMethodWithPromise('unregisterUserByID');
};
Recognition.prototype = new common.BindingObjectPrototype();
Recognition.prototype.constructor = Recognition;

var FaceModule = function(previewStream, object_id) {
  if (!((previewStream instanceof webkitMediaStream) ||
      (previewStream instanceof MediaStream)))
    throw 'Argument is not a MediaStream instance';

  common.BindingObject.call(this, object_id ? object_id : common.getUniqueId());
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
    that.dispatchEvent(
        {type: 'error', data: {error: 'exec_failed', message: 'Video stream ended.'}});
    that.stop().then(
        function() { that.dispatchEvent({type: 'ended'});},
        function(e) { that.dispatchEvent({type: 'ended'});});
  };
  videoElement.onplay = function() {
    that._postMessage('setCamera', [videoTrack.label]);
  };

  if (object_id == undefined)
    internal.postMessage('faceModuleConstructor', [this._id]);

  function wrapProcessedSampleReturns(data) {
    // ProcessedSample layout:
    // color format (int32), width (int32), height (int32), data (int8 buffer),
    // depth format (int32), width (int32), height (int32), data (int16 buffer),
    // number of faces (int32),
    // detection data available (int32),
    // landmark data available (int32),
    // recognition data available (int32),
    // FaceData Array

    // FaceData layout:
    // faceId (int32),
    // detection data: rect x, y, w, h (int32), avgDepth (float32),
    // landmark data: number of landmark points (int32),
    //                landmark point array
    //                    landmark point layout:
    //                    type (int32),
    //                    image confidence (int32),
    //                    world confidence (int32),
    //                    world point x, y, z (float32),
    //                    image point x, y (float32)
    // recognition data: recognition ID(int32),
    var int32_array = new Int32Array(data, 0, 4);
    // color format
    var color_format = '';
    if (int32_array[1] == 1) {
      color_format = 'RGB32';
    } else if (int32_array[1] == 2) {
      color_format = 'DEPTH';
    }
    // color width, height
    var color_width = int32_array[2];
    var color_height = int32_array[3];
    // color data
    var offset = 4 * 4; // 4 int32(4 bytes)
    var color_data =
        new Uint8Array(data, offset, color_width * color_height * 4);
    offset = offset + color_width * color_height * 4;

    int32_array = new Int32Array(data, offset, 3);
    // depth format
    var depth_format = '';
    if (int32_array[0] == 1) {
      depth_format = 'RGB32';
    } else if (int32_array[0] == 2) {
      depth_format = 'DEPTH';
    }
    // depth width, height
    var depth_width = int32_array[1];
    var depth_height = int32_array[2];
    // depth data
    var offset = offset + 3 * 4; // 3 int32(4 bytes)
    var depth_data =
        new Uint16Array(data, offset, depth_width * depth_height);
    offset = offset + depth_width * depth_height * 2;

    var face_array = [];
    int32_array = new Int32Array(data, offset, 4);
    // number of faces
    var num_of_faces = int32_array[0];
    var detection_enabled = int32_array[1] > 0 ? true : false;
    var landmark_enabled = int32_array[2] > 0 ? true : false;
    var recognition_enabled = int32_array[3] > 0 ? true : false;
    offset = offset + 4 * 4; // 4 int32(4 bytes)

    for (var i = 0; i < num_of_faces; ++i) {

      int32_array = new Int32Array(data, offset, 1);
      var faceid_value = int32_array[0];
      offset = offset + 4; // 1 int32(4 bytes)

      var detection_value = undefined;
      var landmark_value = undefined;
      var recognition_value = undefined;
      if (detection_enabled) {
        int32_array = new Int32Array(data, offset, 4);
        offset = offset + 4 * 4; // 4 int32(4 bytes)
        var rect_value = {
          x: int32_array[0],
          y: int32_array[1],
          w: int32_array[2],
          h: int32_array[3],
        };

        var float32_array = new Float32Array(data, offset, 1);
        offset = offset + 4; // 1 float32(4 bytes)
        detection_value = {
          boundingRect: rect_value,
          avgDepth: float32_array[0]
        };
      }
      if (landmark_enabled) {
        var landmark_points_array = [];
        int32_array = new Int32Array(data, offset, 1);
        var num_of_points = int32_array[0];
        offset = offset + 4; // 1 int32(4 bytes)

        for (var j = 0; j < num_of_points; ++j) {
          int32_array = new Int32Array(data, offset, 3);
          offset = offset + 3 * 4; // 3 int32(4 bytes)
          var float32_array = new Float32Array(data, offset, 5);
          offset = offset + 5 * 4; // 5 float32(4 bytes)

          var landmark_point = {
            type: int32_array[0],
            confidenceImage: int32_array[1],
            confidenceWorld: int32_array[2],
            coordinateWorld: { x: float32_array[0], y: float32_array[1], z: float32_array[2] },
            coordinateImage: { x: float32_array[3], y: float32_array[4] },
          };
          landmark_points_array.push(landmark_point);
        }
        landmark_value = { points: landmark_points_array };
      }
      if (recognition_enabled) {
        int32_array = new Int32Array(data, offset, 1);
        offset = offset + 4; // 1 int32(4 bytes)
        var recognitionId = int32_array[0];
        recognition_value = { userId: recognitionId };
      }

      var facedata = {
        faceId: faceid_value,
        detection: detection_value,
        landmarks: landmark_value,
        recognition: recognition_value
      };
      face_array.push(facedata);
    }

    var color_image_value = undefined;
    if (color_width > 0 && color_height > 0) {
      color_image_value = {
        format: color_format,
        width: color_width,
        height: color_height,
        data: color_data
      };
    }
    var depth_image_value = undefined;
    if (depth_width > 0 && depth_height > 0) {
      depth_image_value = {
        format: depth_format,
        width: depth_width,
        height: depth_height,
        data: depth_data
      };
    }

    return {
      color: color_image_value,
      depth: depth_image_value,
      faces: face_array
    };
  }

  this._addMethodWithPromise('start');
  this._addMethodWithPromise('stop');
  this._addMethodWithPromise('getProcessedSample', null, wrapProcessedSampleReturns);

  var FaceErrorEvent = function(type, data) {
    this.type = type;

    if (data) {
      this.error = data.error;
      this.message = data.message;
    }
  };
  this._addEvent('error', FaceErrorEvent);

  this._addEvent('processedsample');
  this._addEvent('ready');
  this._addEvent('ended');

  var faceConfObj = new FaceConfiguration(this._id);
  var recognitionObj = new Recognition(this._id);

  Object.defineProperties(this, {
    'previewStream': {
      value: previewStream,
      configurable: false,
      writable: false,
      enumerable: true,
    },
    'configuration': {
      value: faceConfObj,
      configurable: false,
      writable: false,
      enumerable: true,
    },
    'recognition': {
      value: recognitionObj,
      configurable: false,
      writable: false,
      enumerable: true,
    },
  });
};

FaceModule.prototype = new common.EventTargetPrototype();
FaceModule.prototype.constructor = FaceModule;
exports.FaceModule = FaceModule;
