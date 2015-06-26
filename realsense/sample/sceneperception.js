var qualityElement = document.getElementById('quality');
var accuracyElement = document.getElementById('accuracy');
var startButton = document.getElementById('start');
var resetButton = document.getElementById('reset');
var stopButton = document.getElementById('stop');
var enableTrackingButton = document.getElementById('enableTracking');
var disableTrackingButton = document.getElementById('disableTracking');
var enableMeshingButton = document.getElementById('enableMeshing');
var disableMeshingButton = document.getElementById('disableMeshing');

var blockMeshMap = {};
var totalMesh = null;
var totalMaterials;
var totalGeom;

var scene, renderer, stats, controls, camera;
var z_axis, y_axis, x_axis;

var color_canvas = document.getElementById('color');
var color_context = color_canvas.getContext('2d');
var color_image_data = color_context.createImageData(320, 240);

var depth_canvas = document.getElementById('depth');
var depth_context = depth_canvas.getContext('2d');
var depth_image_data = depth_context.createImageData(320, 240);
var rgb_buffer = new Uint8ClampedArray(320 * 240 * 4);

var sp;

function ConvertDepthToRGBUsingHistogram(
    depthImage, nearColor, farColor, rgbImage) {
  var imageSize = 320 * 240;
  for(var l = 0; l < imageSize; ++l) {
    rgbImage[l * 4] = 0;
    rgbImage[l * 4 + 1] = 0;
    rgbImage[l * 4 + 2] = 0;
    rgbImage[l * 4 + 3] = 255;
  }
  // Produce a cumulative histogram of depth values
  var histogram = new Int32Array(256 * 256);
  var imageSize = 320 * 240;
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

function main() {
  sp = new realsense.ScenePerception();

  var sample_fps = new Stats();
  sample_fps.domElement.style.position = 'absolute';
  sample_fps.domElement.style.top = '0px';
  sample_fps.domElement.style.right = '0px';
  document.getElementById('color_container').appendChild(sample_fps.domElement);

  var getting_sample = false;
  sp.onsample = function(e) {
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
    });
  };

  sp.onchecking = function(e) {
    var quality = e.data.quality;
    qualityElement.innerHTML = 'Quality: ' + quality.toFixed(2);
  };

  sp.ontracking = function(e) {
    accuracyElement.innerHTML = 'Accuracy: ' + e.data.accuracy;
    updateCameraPose(e.data.cameraPose, e.data.accuracy);
  };
  sp.onmeshing = function(e) {
    var func = updateMeshes.bind(this, e.data);
    // do the updateMeshes asynchronously
    setTimeout(func, 0);
  };

  var meshesCreated = false;

  startButton.onclick = function(e) {
    getting_sample = false;
    sp.start().then(function(e) {console.log(e);});
  };

  resetButton.onclick = function(e) {
    sp.reset().then(function(e) {console.log(e);});
    removeAllMeshes();
  };

  stopButton.onclick = function(e) {
    sp.stop().then(function(e) {
      console.log(e);
      qualityElement.innerHTML = 'Quality: ';
    });
  };

  enableTrackingButton.onclick = function(e) {
    sp.enableTracking().then(function(e) {console.log(e);});
  };

  disableTrackingButton.onclick = function(e) {
    sp.disableTracking().then(function(e) {
      console.log(e);
      accuracyElement.innerHTML = 'Accuracy: ';
      showCamera(false);
    });
  };

  enableMeshingButton.onclick = function(e) {
    sp.enableMeshing().then(function(e) {console.log(e);});
  };

  disableMeshingButton.onclick = function(e) {
    sp.disableMeshing().then(function(e) {console.log(e); mergeMeshes();});
  };

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(640, 480);
  document.getElementById('canvas').appendChild(renderer.domElement);

  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  stats.domElement.style.right = '0px';
  document.getElementById('canvas').appendChild(stats.domElement);

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
