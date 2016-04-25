// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const BYTES_PER_INT = 4;
const BYTES_PER_FLOAT = 4;
const BYTES_OF_RGBA = 4;

var ScenePerception = function(objectId) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (objectId == undefined)
    internal.postMessage('scenePerceptionConstructor', [this._id]);


  function wrapSampleReturns(data) {
    var int32Array = new Int32Array(data, 0, 5);
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
    var int32Array = new Int32Array(data, 0, 3);
    var width = int32Array[1];
    var height = int32Array[2];
    var headerOffset = 3 * BYTES_PER_INT;
    var preview = new Uint8Array(data, headerOffset, width * height * BYTES_OF_RGBA);
    return {width: width, height: height, data: preview};
  };

  function wrapGetVolumePreviewReturn(data) {
    var int32Array = new Int32Array(data, 0, 3);
    var width = int32Array[1];
    var height = int32Array[2];
    var imageDimension = width * height;
    var imageDataSize = imageDimension * BYTES_OF_RGBA;
    var verticesOrNormalDataSize = 3 * imageDimension * BYTES_PER_FLOAT;

    var offset = 3 * BYTES_PER_INT;
    var imageData = new Uint8Array(data, offset, imageDataSize);
    offset += imageDataSize;
    var vertices = new Float32Array(data, offset, verticesOrNormalDataSize);
    offset += verticesOrNormalDataSize;
    var normals = new Float32Array(data, offset, verticesOrNormalDataSize);

    return {
      width: width,
      height: height,
      imageData: imageData,
      vertices: vertices,
      normals: normals
    };
  }

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
    var int32Array = new Int32Array(data, 0, 4);
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
    var verticesOffset =
        headerBytesLength + numberOfBlockMesh * blockMeshIntLength * BYTES_PER_INT;
    var vertices =
        new Float32Array(data,
                         verticesOffset,
                         numberOfVertices * 4);
    var facesOffset = verticesOffset + numberOfVertices * 4 * BYTES_PER_FLOAT;
    var faces =
        new Uint32Array(data,
                        facesOffset,
                        numberOfFaces * 3);
    var colorsOffset = facesOffset + numberOfFaces * 3 * BYTES_PER_INT;
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

  function wrapVoxelsReturn(data) {
    // The format:
    //   CallbackID(int32),
    //   dataPending(int32),
    //   numberOfSurfaceVoxels(int32),
    //   hasColorData(int32, whether the color data is available),
    //   centerOfsurface_voxels_data_(Point3D[])
    //   surfaceVoxelsColorData(unit8[], 3 * BYTE,  RGB for each voxel)
    var int32Array = new Int32Array(data, 0, 4);
    var dataPending = int32Array[1];
    var numberOfVoxels = int32Array[2];
    var hasColorData = int32Array[3];
    var voxelsOffset = 4 * BYTES_PER_INT;
    var voxels = new Float32Array(data, voxelsOffset, numberOfVoxels * 3);
    var colorData = null;
    if (hasColorData) {
      var colorDataOffset = voxelsOffset + numberOfVoxels * 3 * BYTES_PER_FLOAT;
      colorData = new Uint8Array(data, colorDataOffset, numberOfVoxels * 3);
    }

    return {
      dataPending: dataPending,
      centerOfSurfaceVoxels: voxels,
      numberOfSurfaceVoxels: numberOfVoxels,
      surfaceVoxelsColor: colorData

    };
  }

  function wrapMeshFileReturn(data) {
    // 1 int32 (4 bytes) value (callback id).
    var dataBuffer = data.slice(4);
    var blob = new Blob([dataBuffer], { type: 'text/plain' });
    return blob;
  }

  function wrapVerticesOrNormalsReturn(data) {
    var int32Array = new Int32Array(data, 0, 3);
    var width = int32Array[1];
    var height = int32Array[2];
    var data = new Float32Array(data, 3 * BYTES_PER_FLOAT);
    return {
      width: width,
      height: height,
      data: data
    };
  }

  function wrapErrorReturns(error) {
    return new DOMException(error.message, error.name);
  }

  this._addMethodWithPromise('init', null, null, wrapErrorReturns);
  this._addMethodWithPromise('reset', null, null, wrapErrorReturns);
  this._addMethodWithPromise('start', null, null, wrapErrorReturns);
  this._addMethodWithPromise('stop', null, null, wrapErrorReturns);
  this._addMethodWithPromise('destroy', null, null, wrapErrorReturns);

  this._addMethodWithPromise('enableReconstruction', null, null, wrapErrorReturns);
  this._addMethodWithPromise('enableRelocalization', null, null, wrapErrorReturns);
  this._addMethodWithPromise('setMeshingResolution', null, null, wrapErrorReturns);
  this._addMethodWithPromise('setMeshingThresholds', null, null, wrapErrorReturns);
  this._addMethodWithPromise('setCameraPose', null, null, wrapErrorReturns);
  this._addMethodWithPromise('setMeshingUpdateConfigs', null, null, wrapErrorReturns);
  this._addMethodWithPromise('configureSurfaceVoxelsData', null, null, wrapErrorReturns);
  this._addMethodWithPromise('setMeshingRegion', null, null, wrapErrorReturns);

  this._addMethodWithPromise('getSample', null, wrapSampleReturns, wrapErrorReturns);
  this._addMethodWithPromise('getVolumePreview', null, wrapGetVolumePreviewReturn,
                             wrapErrorReturns);
  this._addMethodWithPromise('queryVolumePreview', null, wrapVolumePreviewReturn, wrapErrorReturns);
  this._addMethodWithPromise('getVertices', null, wrapVerticesOrNormalsReturn, wrapErrorReturns);
  this._addMethodWithPromise('getNormals', null, wrapVerticesOrNormalsReturn, wrapErrorReturns);
  this._addMethodWithPromise('isReconstructionEnabled', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getVoxelResolution', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getVoxelSize', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getInternalCameraIntrinsics', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getMeshingThresholds', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getMeshingResolution', null, null, wrapErrorReturns);
  this._addMethodWithPromise('getMeshData', null, wrapMeshDataReturn, wrapErrorReturns);
  this._addMethodWithPromise('getSurfaceVoxels', null, wrapVoxelsReturn, wrapErrorReturns);

  this._addMethodWithPromise('saveMesh', null, wrapMeshFileReturn, wrapErrorReturns);
  this._addMethodWithPromise('clearMeshingRegion', null, null, wrapErrorReturns);

  var SPErrorEvent = function(type, data) {
    // Follow https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent
    this.type = type;

    if (data) {
      this.error = new DOMException(data.message, data.error);
      this.message = data.message;
    }
  };

  this._addEvent('error', SPErrorEvent);
  this._addEvent('checking');
  this._addEvent('sampleprocessed');
  this._addEvent('meshupdated');
};

ScenePerception.prototype = new common.EventTargetPrototype();
ScenePerception.prototype.constructor = ScenePerception;

exports = new ScenePerception();
