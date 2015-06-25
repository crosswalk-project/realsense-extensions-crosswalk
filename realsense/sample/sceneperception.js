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

var sp;

function main() {
  sp = new realsense.ScenePerception();
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
