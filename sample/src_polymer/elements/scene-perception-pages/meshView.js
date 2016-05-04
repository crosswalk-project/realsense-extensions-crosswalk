function MeshView(sp, stats, spDom) {
  var canvas = spDom.$$('#meshRender');
  var myWidth = SP_SIZE_WIDTH;
  var myHeight = SP_SIZE_HEIGHT;
  var gl = canvas.getContext('webgl');
  var currentMeshes, meshToDraw, program;
  var modelViewMatrix = new THREE.Matrix4();
  var projectionMatrix = new THREE.Matrix4();
  var initialMatrix = new THREE.Matrix4();
  var indexBuffer, vertexPosBuffer, vertexColorBuffer;
  var onmeshupdatedTime = 0;
  var showing = (canvas.style.display == 'none') ? false : true;

  // Init the GL context.
  initWebGL();
  resize(SP_SIZE_WIDTH, SP_SIZE_HEIGHT);

  function updateMeshes() {
    if (!showing) return;

    thisObj = this;
    onmeshupdatedTime = performance.now();
    sp.getMeshData().then(function(meshes) {
      var getMeshDataTime = performance.now() - onmeshupdatedTime;
      console.log('getMeshData succeeds ' + getMeshDataTime.toFixed(2) + 'ms');
      var func = doUpdateMeshes.bind(thisObj, meshes);
      // do the updateMeshes asynchronously
      setTimeout(func, 0);
    }, function(e) {console.log(e);});
  }

  function getModelView(renderMatrix) {
    var inverse = new THREE.Matrix4();
    inverse.getInverse(renderMatrix);
    var mRot = new THREE.Matrix4();
    mRot.set(1.0, 0, 0, 0, 0, -1.0, 0, 0, 0, 0, -1.0, 0, 0, 0, 0, 1.0);
    mRot.multiply(inverse);
    mRot.transpose();
    return mRot;
  }

  function updateView(renderMatrix) {
    if (!showing) return;

    // Update model view
    modelViewMatrix = getModelView(renderMatrix);
    drawScene();
    stats.update();
  }

  function resize(width, height) {
    if (width == myWidth && height == myHeight) return;

    myWidth = width;
    myHeight = height;
    var realPixelsPerCssPixel = window.devicePixelRatio || 1;
    canvas.width = Math.floor(myWidth * realPixelsPerCssPixel);
    canvas.height = Math.floor(myHeight * realPixelsPerCssPixel);
    canvas.style.width = myWidth;
    canvas.style.height = myHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Params: left, right, top, bottom, near, far.
    initialMatrix.makeOrthographic(0, canvas.width, 0, canvas.height, -1, 1);
  }

  function initWebGL() {
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

    sp.getInternalCameraIntrinsics().then(function(intrinsics) {
      // Compute from GetInternalCameraIntrinsics
      if (intrinsics) {
        projectionMatrix = SPMath.configureAugmentedCamera(intrinsics, 0.0, 0.01, 1000.0);
      } else {
        errorHandler('Got unavailable camera intrinsics.');
      }
    }, errorHandler);

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
  }

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

    gl.uniformMatrix4fv(program.mvMatrixUniform, false, modelViewMatrix.toLineIndexArray());
    gl.uniformMatrix4fv(program.pMatrixUniform, false, projectionMatrix.toLineIndexArray());

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

  function doUpdateMeshes(meshes) {
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

  function resetMeshes() {
    currentMeshes = {};
    meshToDraw = {numberOfVertices: 0, numberOfFaces: 0};
  }

  function showView(enabled) {
    if (enabled) {
      canvas.style.display = '';
      showing = true;
    } else {
      canvas.style.display = 'none';
      showing = false;
    }
  }
  // Export the object;
  this.updateView = updateView;
  this.updateMeshes = updateMeshes;
  this.showView = showView;
  this.reset = resetMeshes;
  this.resize = resize;
}
