var qualityElement = document.getElementById('quality');
var accuracyElement = document.getElementById('accuracy');
var reconstructionElement = document.getElementById('reconstruction');
var savedMeshElement = document.getElementById('savedMesh');
var initButton = document.getElementById('init');
var resetButton = document.getElementById('reset');
var destroyButton = document.getElementById('destroy');
var startButton = document.getElementById('startSP');
var stopButton = document.getElementById('stopSP');
var saveButton = document.getElementById('saveMesh');
var toggleReconstructionButton = document.getElementById('toggleReconstruction');
var volumePreviewRadio = document.getElementById('volumePreviewRadio');
var meshingRadio = document.getElementById('meshingRadio');
var volumePreviewRender = document.getElementById('volumePreviewRender');
var meshingRender = document.getElementById('meshingRender');
var meshingCanvas = document.getElementById('meshingCanvas');

// color_size, depth_size, frameRate can be specified.
// But the size of volume preview is fixed to be {320, 240}.
var color_size = {width: 320, height: 240};
var depth_size = {width: 320, height: 240};
var unifiedFrameRate = 60;
var volume_preview_size = {width: 320, height: 240};

var color_canvas = document.getElementById('color');
var color_context = color_canvas.getContext('2d');
var color_image_data = color_context.createImageData(color_size.width, color_size.height);

var depth_canvas = document.getElementById('depth');
var depth_context = depth_canvas.getContext('2d');
var depth_image_data = depth_context.createImageData(depth_size.width, depth_size.height);

var volumePreview_canvas = document.getElementById('volumePreview');
var volumePreview_context = volumePreview_canvas.getContext('2d');
var volumePreview_image_data = volumePreview_context.createImageData(
                                   volume_preview_size.width,
                                   volume_preview_size.height);
var getting_volumePreview_image = false;

var sp;

var gl, cameraMatrix, modelViewMatrix, volumePreviewMatrix, translationMatrix;
var currentMeshes, meshToDraw;
var program;

var camera, controls, cameraControlEnabled = false;

function ConvertDepthToRGBUsingHistogram(
    depthImage, nearColor, farColor, rgbImage) {
  var imageSize = depth_size.width * depth_size.height;
  for (var l = 0; l < imageSize; ++l) {
    rgbImage[l * 4] = 0;
    rgbImage[l * 4 + 1] = 0;
    rgbImage[l * 4 + 2] = 0;
    rgbImage[l * 4 + 3] = 255;
  }
  // Produce a cumulative histogram of depth values
  var histogram = new Int32Array(256 * 256);
  for (var i = 0; i < imageSize; ++i) {
    if (depthImage[i]) {
      ++histogram[depthImage[i]];
    }
  }
  for (var j = 1; j < 256 * 256; ++j) {
    histogram[j] += histogram[j - 1];
  }

  // Remap the cumulative histogram to the range 0..256
  for (var k = 1; k < 256 * 256; k++) {
    histogram[k] = (histogram[k] << 8) / histogram[256 * 256 - 1];
  }

  // Produce RGB image by using the histogram to interpolate between two colors
  for (var l = 0; l < imageSize; ++l) {
    if (depthImage[l]) { // For valid depth values (depth > 0)
      // Use the histogram entry (in the range of 0..256) to interpolate between nearColor and
      // farColor
      var t = histogram[depthImage[l]];
      rgbImage[l * 4] = ((256 - t) * nearColor[0] + t * farColor[0]) >> 8;
      rgbImage[l * 4 + 1] = ((256 - t) * nearColor[1] + t * farColor[1]) >> 8;
      rgbImage[l * 4 + 2] = ((256 - t) * nearColor[2] + t * farColor[2]) >> 8;
      rgbImage[l * 4 + 3] = 255;
    }
  }
}

function resetButtonState(beforeStart) {
  initButton.disabled = !beforeStart;
  resetButton.disabled = beforeStart;
  destroyButton.disabled = beforeStart;
  startButton.disabled = beforeStart;
  stopButton.disabled = true;
  saveButton.disabled = true;
  toggleReconstructionButton.disabled = beforeStart;
}

function CmdFlowController(size) {
  var windowSize = size;
  var avaliableSize = size;
  this.reset = function() {
    avaliableSize = windowSize;
  };
  this.get = function() {
    if (avaliableSize < 1) return false;

    avaliableSize--;
    return true;
  };
  this.release = function() {
    avaliableSize++;
    if (avaliableSize > windowSize)
      avaliableSize = windowSize;
  };
}
function main() {
  sp = realsense.ScenePerception;

  var sample_fps = new Stats();
  sample_fps.domElement.style.position = 'absolute';
  sample_fps.domElement.style.top = '0px';
  sample_fps.domElement.style.right = '0px';
  document.getElementById('color_container').appendChild(sample_fps.domElement);
  resetButtonState(true);

  var sampleFlowController = new CmdFlowController(5);

  var updateSampleView = function() {
    if (!sampleFlowController.get())
      return;
    sp.getSample().then(function(sample) {
      color_image_data.data.set(sample.color.data);
      color_context.putImageData(color_image_data, 0, 0);
      ConvertDepthToRGBUsingHistogram(
          sample.depth.data, [255, 0, 0], [20, 40, 255], depth_image_data.data);
      depth_context.putImageData(depth_image_data, 0, 0);
      sample_fps.update();
      sampleFlowController.release();
    }, function(e) {console.log(e);});
  };

  sp.onchecking = function(e) {
    var quality = e.data.quality;
    qualityElement.innerHTML = 'Quality: ' + quality.toFixed(2);

    updateSampleView();
  };

  sp.onsampleprocessed = function(e) {
    accuracyElement.innerHTML = 'Accuracy: ' + e.data.accuracy;
    qualityElement.innerHTML = 'Quality: ' + e.data.quality.toFixed(2);

    //Update the left render view.
    updateSampleView();

    updateCameraPose(e.data.cameraPose, e.data.accuracy);

    //Update right render view.
    if (volumePreviewRender.style.display != 'none') {
      if (getting_volumePreview_image)
        return;
      getting_volumePreview_image = true;
      sp.queryVolumePreview(Array.from(volumePreviewMatrix.elements)).then(function(volumePreview) {
        volumePreview_image_data.data.set(volumePreview.data);
        volumePreview_context.putImageData(volumePreview_image_data, 0, 0);
        getting_volumePreview_image = false;
      }, function(e) {console.log(e);});
    }
  };

  var onmeshupdatedTime = 0;
  sp.onmeshupdated = function(e) {
    thisObj = this;
    onmeshupdatedTime = performance.now();
    sp.getMeshData().then(function(meshes) {
      var getMeshDataTime = performance.now() - onmeshupdatedTime;
      console.log('getMeshData succeeds ' + getMeshDataTime.toFixed(2) + 'ms');
      var func = updateMeshes.bind(thisObj, meshes);
      // do the updateMeshes asynchronously
      setTimeout(func, 0);
    }, function(e) {console.log(e);});
  };

  initButton.onclick = function(e) {
    sampleFlowController.reset();
    var initConfig = {
      useOpenCVCoordinateSystem: false,
      colorCaptureSize: color_size,
      depthCaptureSize: depth_size,
      captureFramerate: unifiedFrameRate
    };
    sp.init(initConfig).then(function() {
      resetButtonState(false);
      reconstructionElement.innerHTML = 'Reconstruction: ' + true;
      console.log('init succeeds');}, function(e) {console.log(e);});
  };

  resetButton.onclick = function(e) {
    sp.reset().then(function() {console.log('reset succeeds');}, function(e) {console.log(e);});
    resetMeshes();
  };

  destroyButton.onclick = function(e) {
    sp.destroy().then(function() {
      console.log('stop succeeds');
      resetButtonState(true);
      enableCameraControl(true);
      qualityElement.innerHTML = 'Quality: ';
    }, function(e) {console.log(e);});
  };

  startButton.onclick = function(e) {
    sp.start().then(function() {
      startButton.disabled = true;
      stopButton.disabled = false;
      saveButton.disabled = false;
      resetMeshes();
      enableCameraControl(false);
      console.log('SP started successfully');
    }, function(e) {console.log(e);});
  };

  stopButton.onclick = function(e) {
    sp.stop().then(function() {
      console.log('SP stops working.');
      startButton.disabled = false;
      stopButton.disabled = true;
      accuracyElement.innerHTML = 'Accuracy: ';
      enableCameraControl(true);
    }, function(e) {console.log(e);});
  };

  saveButton.onclick = function(e) {
    sp.saveMesh().then(function(blob) {
      xwalk.experimental.native_file_system.requestNativeFileSystem('documents', function(fs) {
        var fileName = '/documents/savedMesh_' + RSUtils.getDateString() + '.obj';
        fs.root.getFile(fileName, { create: true }, function(entry) {
          entry.createWriter(function(writer) {
            writer.onwriteend = function(e) {
              savedMeshElement.innerHTML = 'Saved Mesh:' + fileName;
            };
            writer.onerror = function(e) {
              savedMeshElement.innerHTML = 'Saved Mesh:save failed, error' + e.toString();
            };
            writer.write(blob);
          }, function(e) {console.log(e);});
        }, function(e) {console.log(e)});
      });
    }, function(e) {console.log(e);});
  };

  toggleReconstructionButton.onclick = function(e) {
    sp.isReconstructionEnabled().then(function(enabled) {
      sp.enableReconstruction(!enabled).then(function() {
        reconstructionElement.innerHTML = 'Reconstruction: ' + !enabled;
        console.log('Toggle reconstruction succeeds');
      }, function(e) {console.log(e);});
    }, function(e) {console.log(e);});
  };

  volumePreviewRadio.addEventListener('click', function(e) {
    if (volumePreviewRadio.checked) {
      meshingRender.style.display = 'none';
      volumePreviewRender.style.display = '';
    }
  }, false);

  meshingRadio.addEventListener('click', function(e) {
    if (meshingRadio.checked) {
      meshingRender.style.display = '';
      volumePreviewRender.style.display = 'none';
    }
  }, false);

  initWebGL();

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  stats.domElement.style.right = '0px';
  meshingRender.appendChild(stats.domElement);

  animate();
}

function updateCameraPose(cameraPose, accuracy) {
  if (accuracy == 'low' || accuracy == 'failed') {
    return;
  }

  updateVolumePreviewMatrix(cameraPose);
  updateMeshingModelViewMatrix(cameraPose);
}

function resetMeshes() {
  currentMeshes = {};
  meshToDraw = {numberOfVertices: 0, numberOfFaces: 0};
}

function updateVolumePreviewMatrix(cameraPose) {
  volumePreviewMatrix.set(
      cameraPose[0], cameraPose[1], cameraPose[2], cameraPose[3],
      cameraPose[4], cameraPose[5], cameraPose[6], cameraPose[7],
      cameraPose[8], cameraPose[9], cameraPose[10], cameraPose[11],
      0.0, 0.0, 0.0, 1.0);

  volumePreviewMatrix.multiply(translationMatrix);
  volumePreviewMatrix.transpose();
}

function updateMeshingModelViewMatrix(cameraPose) {
  modelViewMatrix.identity();

  var rotZMatrix = new THREE.Matrix4();
  rotZMatrix.makeRotationZ(180 * Math.PI / 180);
  modelViewMatrix.multiply(rotZMatrix);

  modelViewMatrix.multiply(translationMatrix);

  cameraMatrix.set(
      -cameraPose[0], cameraPose[1], -cameraPose[2], cameraPose[3],
      -cameraPose[4], cameraPose[5], -cameraPose[6], cameraPose[7],
      -cameraPose[8], cameraPose[9], -cameraPose[10], -cameraPose[11],
      0, 0, 0, 1.0);

  cameraMatrix.transpose();

  modelViewMatrix.multiply(cameraMatrix);
}

var fov = 74;
var aspect = 320 / 240;

function setProjectionMatrix(cameraIntrinsic) {
  // TODO: compute from GetInternalCameraIntrinsics
  projectionMatrix.makePerspective(fov, aspect, 0.001, 1000);
}

function initWebGL() {
  gl = meshingCanvas.getContext('webgl');

  var ext = gl.getExtension('OES_element_index_uint');
  if (ext === null) {
    throw 'OES_element_index_uint is not supported';
  }

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var vstr =
      'attribute vec3 position;' +
      'attribute vec3 color;' +
      'uniform mat4 modelViewMatrix ;' +
      'uniform mat4 projectionMatrix ;' +
      'varying vec3 vColor;' +
      'void main() {' +
      '  gl_Position = projectionMatrix  * modelViewMatrix  * vec4(position, 1.0);' +
      '  vColor = color;' +
      '}';
  var fstr =
      'precision mediump float;' +
      'varying vec3 vColor;' +
      'void main() { gl_FragColor = vec4(vColor, 1.0); }';

  program = gl.createProgram();

  var vshader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vshader, vstr);
  gl.compileShader(vshader);

  var fshader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fshader, fstr);
  gl.compileShader(fshader);

  gl.attachShader(program, vshader);
  gl.attachShader(program, fshader);

  gl.linkProgram(program);

  gl.enable(gl.DEPTH_TEST);

  // Matrices for volumePreview
  volumePreviewMatrix = new THREE.Matrix4();

  // Matrices for meshingRenderer
  cameraMatrix = new THREE.Matrix4();
  modelViewMatrix = new THREE.Matrix4();
  projectionMatrix = new THREE.Matrix4();

  // For both
  translationMatrix = new THREE.Matrix4();
  translationMatrix.makeTranslation(0, 0, -2);

  setProjectionMatrix();

  resetMeshes();

  indexBuffer = gl.createBuffer();
  vertexPosBuffer = gl.createBuffer();
  vertexColorBuffer = gl.createBuffer();

  program.vertexPosAttrib = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(program.vertexPosAttrib);

  program.vertexColorAttribute = gl.getAttribLocation(program, 'color');
  gl.enableVertexAttribArray(program.vertexColorAttribute);

  program.mvMatrixUniform = gl.getUniformLocation(program, 'modelViewMatrix');
  program.pMatrixUniform = gl.getUniformLocation(program, 'projectionMatrix');

  enableCameraControl(false);
}

function enableCameraControl(enabled) {
  if (!cameraControlEnabled && enabled) {
    camera = new THREE.PerspectiveCamera(fov, aspect, 0.001, 1000);
    camera.position.set(0, 0, 2);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    controls = new THREE.TrackballControls(camera, meshingCanvas);
  }
  cameraControlEnabled = enabled;
}

function updateCameraControl() {
  controls.update();
  camera.updateMatrixWorld();
  camera.matrixWorldInverse.getInverse(camera.matrixWorld);
  modelViewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  modelViewMatrix.identity();
  modelViewMatrix.multiply(camera.matrixWorldInverse);
}

var indexBuffer, vertexPosBuffer, vertexColorBuffer;

function upateBuffers() {
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, meshToDraw.faces, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, meshToDraw.vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, meshToDraw.colors, gl.STATIC_DRAW);
}

function drawScene() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (meshToDraw.numberOfFaces == 0) {
    return;
  }

  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
  gl.vertexAttribPointer(program.vertexPosAttrib, 3, gl.FLOAT, false, 16, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexColorBuffer);
  gl.vertexAttribPointer(program.vertexColorAttribute, 3, gl.UNSIGNED_BYTE, true, 0, 0);

  gl.uniformMatrix4fv(program.mvMatrixUniform, false, modelViewMatrix.elements);
  gl.uniformMatrix4fv(program.pMatrixUniform, false, projectionMatrix.elements);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, meshToDraw.numberOfFaces * 3, gl.UNSIGNED_INT, 0);
}

function mergeMeshes() {
  console.time('mergeMeshes');
  meshToDraw.numberOfVertices = 0;
  meshToDraw.numberOfFaces = 0;
  var mergedMeshes = 0;
  for (var id in currentMeshes) {
    var mesh = currentMeshes[id];
    meshToDraw.numberOfVertices += mesh.numberOfVertices;
    meshToDraw.numberOfFaces += mesh.numberOfFaces;
    mergedMeshes++;
  }
  console.log('mergedMeshes: ' + mergedMeshes);
  console.log('meshToDraw.numberOfVertices: ' + meshToDraw.numberOfVertices);
  console.log('meshToDraw.numberOfFaces: ' + meshToDraw.numberOfFaces);

  meshToDraw.vertices = new Float32Array(meshToDraw.numberOfVertices * 4);
  meshToDraw.faces = new Uint32Array(meshToDraw.numberOfFaces * 3);
  meshToDraw.colors = new Uint8Array(meshToDraw.numberOfVertices * 3);

  var vertexOffset = 0;
  var faceOffset = 0;
  for (var id in currentMeshes) {
    var mesh = currentMeshes[id];
    meshToDraw.vertices.set(mesh.vertices, vertexOffset * 4);
    meshToDraw.colors.set(mesh.colors, vertexOffset * 3);
    for (var i = 0; i < mesh.numberOfFaces * 3; faceOffset++, i++) {
      meshToDraw.faces[faceOffset] = mesh.faces[i] + vertexOffset;
    }
    vertexOffset += mesh.numberOfVertices;
  }

  console.timeEnd('mergeMeshes');
}

function updateMeshes(meshes) {
  console.time('updateMeshes');
  console.log('numberOfVertices: ' + meshes.numberOfVertices);
  console.log('numberOfFaces: ' + meshes.numberOfFaces);

  var vertices = meshes.vertices;
  var colors = meshes.colors;
  var faces = meshes.faces;
  var blockMeshes = meshes.blockMeshes;

  var updated = 0;
  for (var j = 0; j < blockMeshes.length; ++j) {
    var blockMesh = blockMeshes[j];
    if (blockMesh.numVertices == 0 || blockMesh.numFaces == 0)
      continue;
    if (blockMesh.meshId in currentMeshes) {
      delete currentMeshes[blockMesh.meshId];
      updated++;
    }

    const floatsPerVertex = 4;
    const uint16PerFace = 3;
    var verticesBuffer = vertices.slice(
        blockMesh.vertexStartIndex,
        blockMesh.vertexStartIndex + blockMesh.numVertices * floatsPerVertex);
    var facesBuffer = faces.slice(
        blockMesh.faceStartIndex,
        blockMesh.faceStartIndex + blockMesh.numFaces * uint16PerFace);
    var colorsBuffer = colors.slice(
        3 * blockMesh.vertexStartIndex / 4,
        3 * blockMesh.vertexStartIndex / 4 + blockMesh.numVertices * 3);

    currentMeshes[blockMesh.meshId] = {
      numberOfVertices: blockMesh.numVertices,
      vertices: verticesBuffer,
      numberOfFaces: blockMesh.numFaces,
      faces: facesBuffer,
      colors: colorsBuffer
    };
  }

  console.log('blockMeshes.length: ' + blockMeshes.length);
  console.log('updated blockMeshes: ' + updated);

  console.timeEnd('updateMeshes');

  mergeMeshes();

  upateBuffers();
}

function animate() {
  requestAnimationFrame(animate);

  drawScene();

  stats.update();

  if (cameraControlEnabled) {
    updateCameraControl();
  }
}
