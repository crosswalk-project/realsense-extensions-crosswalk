// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var ScenePerception = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());
  common.EventTarget.call(this);

  if (object_id == undefined)
    internal.postMessage('scenePerceptionConstructor', [this._id]);

  function wrapSampleReturns(data) {
    var int32_array = new Int32Array(data);
    var width = int32_array[1];
    var height = int32_array[2];
    var header_offset = 3 * 4;
    var color = new Uint8Array(data, header_offset, width * height * 4);
    var depth = new Uint16Array(data, header_offset + width * height * 4, width * height);
    return {color: {width: width, height: height, data: color},
      depth: {width: width, height: height, data: depth}};
  };

  function MeshingEvent(type, data) {
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
    var int32Array = new Int32Array(data);
    var numberOfBlockMesh = int32Array[1];
    var numberOfVertices = int32Array[2];
    var numberOfFaces = int32Array[3];
    var blockMeshes = [];
    var headerBytesLength = 4 * 4;
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
    var verticesOffset = headerBytesLength + numberOfBlockMesh * blockMeshIntLength * 4;
    var vertices =
        new Float32Array(data,
                         verticesOffset,
                         numberOfVertices * 4);
    var facesOffset = verticesOffset + numberOfVertices * 4 * 4;
    var faces =
        new Int32Array(data,
                       facesOffset,
                       numberOfFaces * 3);
    var colorsOffset = facesOffset + numberOfFaces * 3 * 4;
    var colors =
        new Uint8Array(data,
                       colorsOffset,
                       numberOfVertices * 3);
    var meshes = {blockMeshes: blockMeshes,
      numberOfVertices: numberOfVertices,
      vertices: vertices,
      colors: colors,
      numberOfFaces: numberOfFaces,
      faces: faces};
    this.type = type;
    this.meshes = meshes;
  }

  this._addMethodWithPromise('start');
  this._addMethodWithPromise('stop');
  this._addMethodWithPromise('reset');
  this._addMethodWithPromise('enableTracking');
  this._addMethodWithPromise('disableTracking');
  this._addMethodWithPromise('enableMeshing');
  this._addMethodWithPromise('disableMeshing');
  this._addMethodWithPromise('getSample', null, wrapSampleReturns);

  this._addEvent('error');
  this._addEvent('sample');
  this._addEvent('checking');
  this._addEvent('tracking');
  this._addEvent('meshing', MeshingEvent);
};

ScenePerception.prototype = new common.EventTargetPrototype();
ScenePerception.prototype.constructor = ScenePerception;

exports = ScenePerception;
