var qualityElement = document.getElementById('quality');
var accuracyElement = document.getElementById('accuracy');
var reconstructionElement = document.getElementById('reconstruction');
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

var blockMeshMap = {};
var totalMesh = null;
var totalMaterials;
var totalGeom;

var scene, renderer, stats, controls, camera;
var z_axis, y_axis, x_axis;

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

function main() {
  sp = realsense.ScenePerception;

  var sample_fps = new Stats();
  sample_fps.domElement.style.position = 'absolute';
  sample_fps.domElement.style.top = '0px';
  sample_fps.domElement.style.right = '0px';
  document.getElementById('color_container').appendChild(sample_fps.domElement);
  resetButtonState(true);

  var getting_sample = false;

  var updateSampleView = function() {
    if (getting_sample)
      return;
    getting_sample = true;
    sp.getSample().then(function(sample) {
      color_image_data.data.set(sample.color.data);
      color_context.putImageData(color_image_data, 0, 0);
      ConvertDepthToRGBUsingHistogram(
          sample.depth.data, [255, 0, 0], [20, 40, 255], depth_image_data.data);
      depth_context.putImageData(depth_image_data, 0, 0);
      sample_fps.update();
      getting_sample = false;
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

    //Update right render view.
    if (volumePreviewRender.style.display != 'none') {
      if (getting_volumePreview_image)
        return;
      getting_volumePreview_image = true;
      sp.getVolumePreview(e.data.cameraPose).then(function(volumePreview) {
        volumePreview_image_data.data.set(volumePreview.data);
        volumePreview_context.putImageData(volumePreview_image_data, 0, 0);
        getting_volumePreview_image = false;
      }, function(e) {console.log(e);});
    } else {
      updateCameraPose(e.data.cameraPose, e.data.accuracy);
    }
  };

  sp.onmeshupdated = function(e) {
    thisObj = this;
    sp.getMeshData().then(function(meshes) {
      var func = updateMeshes.bind(thisObj, meshes);
      // do the updateMeshes asynchronously
      setTimeout(func, 0);
    }, function(e) {console.log(e);});
  };

  var meshesCreated = false;

  initButton.onclick = function(e) {
    getting_sample = false;
    var initConfig = {
      useOpenCVCoordinateSystem: true,
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
    removeAllMeshes();
  };

  destroyButton.onclick = function(e) {
    sp.destroy().then(function() {
      console.log('stop succeeds');
      resetButtonState(true);
      qualityElement.innerHTML = 'Quality: ';
    }, function(e) {console.log(e);});
  };

  startButton.onclick = function(e) {
    sp.start().then(function() {
      startButton.disabled = true;
      stopButton.disabled = false;
      saveButton.disabled = false;
      console.log('SP started successfully');
    }, function(e) {console.log(e);});
  };

  stopButton.onclick = function(e) {
    sp.stop().then(function() {
      console.log('SP stops working.');
      startButton.disabled = false;
      stopButton.disabled = true;
      accuracyElement.innerHTML = 'Accuracy: ';
      showCamera(false);
    }, function(e) {console.log(e);});
  };

  saveButton.onclick = function(e) {
    sp.saveMesh().then(function(blob) {
      var reader = new FileReader();
      reader.onload = function(evt) {
        console.log(evt.target.result);
        // Currently, crosswalk has bugs to download (see XWALK-5220). So the following code
        // doesn't work. Once download is enabled. The processed image will be
        // downloaded into 'Downloads' folder.
        var a = document.createElement('a');
        a.href = evt.target.result;
        a.download = true;
        a.click();
        alert('Save successfully');
      };
      reader.readAsDataURL(blob);
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

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(640, 480);
  meshingRender.appendChild(renderer.domElement);

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  stats.domElement.style.right = '0px';
  meshingRender.appendChild(stats.domElement);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 0, 3);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  scene = new THREE.Scene();

  controls = new THREE.TrackballControls(camera);

  var x_material = new THREE.LineBasicMaterial({
    color: new THREE.Color(1, 0, 0), linewidth: 4
  });

  var y_material = new THREE.LineBasicMaterial({
    color: new THREE.Color(0, 1, 0), linewidth: 4
  });

  var z_material = new THREE.LineBasicMaterial({
    color: new THREE.Color(0, 0, 1), linewidth: 4
  });

  var x_geometry = new THREE.Geometry();
  x_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
  x_geometry.vertices.push(new THREE.Vector3(0, 0, 0));

  var y_geometry = new THREE.Geometry();
  y_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
  y_geometry.vertices.push(new THREE.Vector3(0, 0, 0));

  var z_geometry = new THREE.Geometry();
  z_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
  z_geometry.vertices.push(new THREE.Vector3(0, 0, 0));

  z_axis = new THREE.Line(z_geometry, z_material);
  y_axis = new THREE.Line(y_geometry, y_material);
  x_axis = new THREE.Line(x_geometry, x_material);

  scene.add(z_axis);
  scene.add(y_axis);
  scene.add(x_axis);

  animate();
}

function removeAllMeshes() {
  for (var id in blockMeshMap) {
    scene.remove(blockMeshMap[id]);
    delete blockMeshMap[id];
  }
  if (totalMesh)
    scene.remove(totalMesh);
  delete totalMesh;
  totalMesh = null;
}

var timeout = null;

function mergeMeshes() {
  if (blockMeshMap.length == 0)
    return;
  console.time('mergeMeshes');
  totalMaterials = [];
  totalGeom = new THREE.Geometry();
  for (var id in blockMeshMap) {
    var m = blockMeshMap[id];
    m.updateMatrix();
    totalGeom.merge(m.geometry, m.matrix);
    totalMaterials.push(m.material);
  }
  if (totalMesh)
    scene.remove(totalMesh);
  totalMesh = new THREE.Mesh(totalGeom, new THREE.MeshFaceMaterial(totalMaterials));
  scene.add(totalMesh);
  timeout = null;
  console.timeEnd('mergeMeshes');
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

function poseMultiplyVect(out, pose, vect) {
  out.x = pose[0] * vect.x + pose[1] * vect.y + pose[2] * vect.z + pose[3] * vect.w;
  out.y = pose[4] * vect.x + pose[5] * vect.y + pose[6] * vect.z + pose[7] * vect.w;
  out.z = pose[8] * vect.x + pose[9] * vect.y + pose[10] * vect.z + pose[11] * vect.w;
  out.w = vect.w;
}

function showCamera(show) {
  x_axis.material.visible = show;
  y_axis.material.visible = show;
  z_axis.material.visible = show;
}

function updateCameraPose(cameraPoseArray, accuracy) {
  if (accuracy == 'low' || accuracy == 'failed') {
    showCamera(false);
    return;
  } else {
    showCamera(true);
  }
  cameraPoseArray[7] = -cameraPoseArray[7];
  var cameraCenter = new THREE.Vector3(cameraPoseArray[3], cameraPoseArray[7], cameraPoseArray[11]);
  var cameraXAxis = new THREE.Vector4(0, 0, 0, 0);
  var xVect = new THREE.Vector4(0.16, 0.0, 0.0, 1.0);
  poseMultiplyVect(cameraXAxis, cameraPoseArray, xVect);
  var cameraYAxis = new THREE.Vector4(0, 0, 0, 0);
  var yVect = new THREE.Vector4(0.0, 0.16, 0.0, 1.0);
  poseMultiplyVect(cameraYAxis, cameraPoseArray, yVect);
  var cameraZAxis = new THREE.Vector4(0, 0, 0, 0);
  var zVect = new THREE.Vector4(0.0, 0.0, 0.16, 1.0);
  poseMultiplyVect(cameraZAxis, cameraPoseArray, zVect);

  z_axis.geometry.dynamic = true;
  z_axis.geometry.vertices[0] = cameraCenter;
  z_axis.geometry.vertices[1] = new THREE.Vector3(cameraZAxis.x, cameraZAxis.y, cameraZAxis.z);
  z_axis.geometry.verticesNeedUpdate = true;

  y_axis.geometry.dynamic = true;
  y_axis.geometry.vertices[0] = cameraCenter;
  y_axis.geometry.vertices[1] = new THREE.Vector3(cameraYAxis.x, cameraYAxis.y, cameraYAxis.z);
  y_axis.geometry.verticesNeedUpdate = true;

  x_axis.geometry.dynamic = true;
  x_axis.geometry.vertices[0] = cameraCenter;
  x_axis.geometry.vertices[1] = new THREE.Vector3(cameraXAxis.x, cameraXAxis.y, cameraXAxis.z);
  x_axis.geometry.verticesNeedUpdate = true;
}

function updateMeshes(meshes) {
  console.time('updateMeshes');
  var vertices = meshes.vertices;
  var colors = meshes.colors;
  var faces = meshes.faces;
  var blockMeshes = meshes.blockMeshes;
  for (var j = 0; j < blockMeshes.length; ++j) {
    var blockMesh = blockMeshes[j];
    if (blockMesh.numVertices == 0 || blockMesh.numFaces == 0)
      continue;
    if (blockMesh.meshId in blockMeshMap) {
      delete blockMeshMap[blockMesh.meshId];
    }
    var geometry = new THREE.Geometry();
    var elements = blockMesh.numVertices;
    var vertexStartIndex = blockMesh.vertexStartIndex;
    for (var i = 0; i < elements; i++) {
      var index = i * 4;
      geometry.vertices.push(
          new THREE.Vector3(vertices[vertexStartIndex + index],
                            vertices[vertexStartIndex + index + 1],
                            vertices[vertexStartIndex + index + 2]));
    }
    var elements = blockMesh.numFaces;
    var faceStartIndex = blockMesh.faceStartIndex;
    for (var i = 0; i < elements; i++) {
      var index = i * 3;
      var vertexOffset = vertexStartIndex / 4;
      geometry.faces.push(
          new THREE.Face3(faces[faceStartIndex + index] - vertexOffset,
                          faces[faceStartIndex + index + 1] - vertexOffset,
                          faces[faceStartIndex + index + 2] - vertexOffset));
      var face = faces[faceStartIndex + index] * 3;
      geometry.faces[i].vertexColors[0] =
          new THREE.Color(
              'rgb(' + colors[face] + ',' + colors[face + 1] + ',' + colors[face + 2] + ')');
      var face = faces[faceStartIndex + index + 1] * 3;
      geometry.faces[i].vertexColors[1] =
          new THREE.Color(
              'rgb(' + colors[face] + ',' + colors[face + 1] + ',' + colors[face + 2] + ')');
      var face = faces[faceStartIndex + index + 2] * 3;
      geometry.faces[i].vertexColors[2] =
          new THREE.Color(
              'rgb(' + colors[face] + ',' + colors[face + 1] + ',' + colors[face + 2] + ')');
    }

    var material = new THREE.MeshBasicMaterial({
      vertexColors: THREE.VertexColors, side: THREE.BackSide});
    geometry.computeFaceNormals();
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = 0;
    mesh.position.y = 0;
    mesh.position.z = 0;
    mesh.rotation.z += 180 * (Math.PI / 180);
    mesh.rotation.y += 180 * (Math.PI / 180);
    var wire_material = new THREE.MeshLambertMaterial({
      color: 0xffffff, visible: true, wireframe: true, transparent: true, opacity: 0.15
    });
    var wire_mesh = new THREE.Mesh(geometry, wire_material);
    wire_mesh.position.x = 0;
    wire_mesh.position.y = 0;
    wire_mesh.position.z = 0;
    wire_mesh.rotation.z += 180 * (Math.PI / 180);
    wire_mesh.rotation.y += 180 * (Math.PI / 180);

    blockMeshMap[blockMesh.meshId] = mesh;
  }

  if (timeout === null) {
    timeout = setTimeout(mergeMeshes, 250);
  }
  console.timeEnd('updateMeshes');
}

function animate() {
  requestAnimationFrame(animate);

  render();
  stats.update();
}
