// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var ScenePerception = function(objectId) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (objectId == undefined)
    internal.postMessage('scenePerceptionConstructor', [this._id]);


  function wrapSampleReturns(data) {
    const BYTES_PER_INT = 4;
    const BYTES_OF_RGBA = 4;
    var int32Array = new Int32Array(data);
    var cWidth = int32Array[1];
    var cHeight = int32Array[2];
    var dWidth = int32Array[3];
    var dHeight = int32Array[4];
    var headerOffset = 5 * BYTES_PER_INT;
    var cByteLength = cWidth * cHeight * BYTES_OF_RGBA;
    var color = new Uint8Array(data, headerOffset, cByteLength);
    var depth = new Uint16Array(data, headerOffset + cByteLength, dWidth * dHeight);
    return {color: {width: cWidth, height: cHeight, data: color},
      depth: {width: dWidth, height: dHeight, data: depth}};
  };

  function wrapVolumePreviewReturn(data) {
    const BYTES_PER_INT = 4;
    const BYTES_OF_RGBA = 4;
    var int32Array = new Int32Array(data);
    var width = int32Array[1];
    var height = int32Array[2];
    var headerOffset = 3 * BYTES_PER_INT;
    var preview = new Uint8Array(data, headerOffset, width * height * BYTES_OF_RGBA);
    return {width: width, height: height, data: preview};
  };

  function wrapMeshDataReturn(data) {
    // MeshData layout
    // NumBlockMesh: int32
    // NumVertices: int32
    // NumFaces: int32
    // BlockMesh Array
    // Vertices Array (Float32Array)
    // Faces Array (Int32Array)
    // Colors Array (Uint8Array)

    // BlockMesh layout
    // MeshId: int32
    // VertexStartIndex: int32
    // NumVertices: int32
    // FaceStartIndex: int32
    // NumFaces: int32
    console.log('MeshingEvent');
    const BYTES_PER_INT = 4;
    const BYTES_PER_FLOAT = 4;
    var int32Array = new Int32Array(data);
    var numberOfBlockMesh = int32Array[1];
    var numberOfVertices = int32Array[2];
    var numberOfFaces = int32Array[3];
    var blockMeshes = [];
    var headerBytesLength = 4 * BYTES_PER_INT;
    var blockMeshIntLength = 5;
    var blockMeshesArray =
        new Int32Array(data, headerBytesLength, numberOfBlockMesh * blockMeshIntLength);
    for (var i = 0; i < numberOfBlockMesh; ++i) {
      var blockMesh = {
        meshId: blockMeshesArray[i * blockMeshIntLength],
        vertexStartIndex: blockMeshesArray[i * blockMeshIntLength + 1],
        numVertices: blockMeshesArray[i * blockMeshIntLength + 2],
        faceStartIndex: blockMeshesArray[i * blockMeshIntLength + 3],
        numFaces: blockMeshesArray[i * blockMeshIntLength + 4]
      };
      blockMeshes.push(blockMesh);
    }
    var verticesOffset = headerBytesLength + numberOfBlockMesh * blockMeshIntLength * BYTES_PER_INT;
    var vertices =
        new Float32Array(data,
                         verticesOffset,
                         numberOfVertices * 4);
    var facesOffset = verticesOffset + numberOfVertices * 4 * BYTES_PER_FLOAT;
    var faces =
        new Int32Array(data,
                       facesOffset,
                       numberOfFaces * 3);
    var colorsOffset = facesOffset + numberOfFaces * 3 * BYTES_PER_FLOAT;
    var colors =
        new Uint8Array(data,
                       colorsOffset,
                       numberOfVertices * 3);
    return {blockMeshes: blockMeshes,
      numberOfVertices: numberOfVertices,
      vertices: vertices,
      colors: colors,
      numberOfFaces: numberOfFaces,
      faces: faces};
  }

  function wrapVerticesOrNormalsReturn(data) {
    const BYTES_PER_FLOAT = 4;
    var int32Array = new Int32Array(data);
    var width = int32Array[1];
    var height = int32Array[2];
    var data = new Float32Array(data, 3 * BYTES_PER_FLOAT);
    return {
      width: width,
      height: height,
      data: data
    };
  }

  this._addMethodWithPromise('init');
  this._addMethodWithPromise('reset');
  this._addMethodWithPromise('start');
  this._addMethodWithPromise('stop');
  this._addMethodWithPromise('destory');

  this._addMethodWithPromise('enableReconstruction');
  this._addMethodWithPromise('setMeshingResolution');
  this._addMethodWithPromise('setMeshingThresholds');
  this._addMethodWithPromise('setCameraPose');
  this._addMethodWithPromise('setMeshingUpdateConfigs');

  this._addMethodWithPromise('getSample', null, wrapSampleReturns);
  this._addMethodWithPromise('getVolumePreview', null, wrapVolumePreviewReturn);
  this._addMethodWithPromise('getVertices', null, wrapVerticesOrNormalsReturn);
  this._addMethodWithPromise('getNormals', null, wrapVerticesOrNormalsReturn);
  this._addMethodWithPromise('isReconstructionEnabled');
  this._addMethodWithPromise('getVoxelResolution');
  this._addMethodWithPromise('getMeshingThresholds');
  this._addMethodWithPromise('getMeshingResolution');
  this._addMethodWithPromise('getMeshData', null, wrapMeshDataReturn);

  this._addEvent('error');
  this._addEvent('checking');
  this._addEvent('sampleprocessed');
  this._addEvent('meshupdated');
};

ScenePerception.prototype = new common.EventTargetPrototype();
ScenePerception.prototype.constructor = ScenePerception;

exports = new ScenePerception();
