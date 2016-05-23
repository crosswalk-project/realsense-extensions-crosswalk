(function(exports) {
  const SP_SIZE_WIDTH = 320;
  const SP_SIZE_HEIGHT = 240;
  var errorHandler = spReconstructionSample.errorHandler || function(e) {
    console.error(e);
  };

  function RightRender(sp, spDom) {
    var stats, currentPose;
    var volumeDimension = 4;
    var mRenderWidth = SP_SIZE_WIDTH;
    var mRenderHeight = SP_SIZE_HEIGHT;
    var movePose = mat4.create();
    var initialMatrix = mat4.create();
    var translationMatrix = mat4.fromTranslation(
        mat4.create(), vec3.fromValues(-0.5, 0.5, 0));
    translationMatrix[15] *= Math.sqrt(window.devicePixelRatio);
    var views = [];
    var activeView = 0;
    var started = false;
    var isStaticViewpoint = false;

    function init() {
      stats = new Stats();
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.top = '25px';
      stats.domElement.style.right = '150px';
      spDom.$$('#rightContainer').appendChild(stats.domElement);

      sp.getVoxelResolution().then(function(resolution) {
        switch (resolution) {
          case 'low':
            volumeDimension = 4;
            break;
          case 'med':
            volumeDimension = 2;
            break;
          case 'high':
            volumeDimesion = 1;
            break;
          default:
            console.warning('Unsupported voxel resolution:' + resolution);
        }
        movePose = getInitialMovePose();
      });

      views = [
        new MeshView(sp, stats, spDom),
        new VolumePreview(sp, stats, spDom)
      ];
      views.forEach(function(e, i) {
        if (i == activeView) {
          e.showView(true);
        } else {
          e.showView(false);
        }
      });

      bindMouseEvent();
    }

    function getInitialMovePose() {
      return SPMath.mat4FromCameraPose([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, -volumeDimension]);
    }

    function bindMouseEvent() {
      var container = spDom.$$('#container');
      var rightContainer = spDom.$$('#rightContainer');
      var leftContainer = spDom.$$('#leftContainer');
      var onDrag = false;
      var startX = -1;
      var startY = -1;

      container.addEventListener('track', function(e) {
        var rect = rightContainer.getBoundingClientRect();
        var x, y;
        switch (e.detail.state) {
          case 'start':
            x = e.detail.x;
            y = e.detail.y;
            if (rect.left <= x && x < rect.right &&
                rect.top <= y && y < rect.bottom) {
                  startX = x;
                  startY = y;
                  onDrag = true;
                } else {
                  startX = -1;
                  startY = -1;
                }
            break;
          case 'track':
            if (startX == -1 && startY == -1) return;

            x = e.detail.x;
            y = e.detail.y;
            if (onDrag) {
              var anglex = 0.5 * (x - startX) / mRenderWidth;
              var angley = -0.5 * (y - startY) / mRenderHeight;
              var incrementMatrixX = SPMath.mat4FromCameraPose([
                Math.cos(anglex), 0, Math.sin(anglex), 0,
                0, 1, 0, 0,
                -Math.sin(anglex), 0, Math.cos(anglex), 0
              ]);

              var incrementMatrixY = SPMath.mat4FromCameraPose([
                1, 0, 0, 0,
                0, Math.cos(angley), -Math.sin(angley), 0,
                0, Math.sin(angley), Math.cos(angley), 0
              ]);
              mat4.mul(incrementMatrixX, incrementMatrixX, incrementMatrixY);
              mat4.mul(movePose, incrementMatrixX, movePose);
            }
            startX = x;
            startY = y;
            break;
          case 'end':
            onDrag = false;
            break;

        }
      });
    }

    function toggleView(viewIndex) {
      if (viewIndex == activeView) return;

      views[activeView].showView(false);
      activeView = viewIndex;
      views[activeView].showView(true);
    }

    function updateView(cameraPose) {
      if (!cameraPose) return;

      currentPose = cameraPose;
      if (!started) {
        animate();
        started = true;
      }
    }

    function animate() {
      if (!isStaticViewpoint) {
        initialMatrix = SPMath.mat4FromCameraPose(currentPose);
      }
      var renderMatrix = mat4.clone(initialMatrix);
      // For meshView.
      if (activeView == 0) {
        mat4.mul(renderMatrix, renderMatrix, translationMatrix);
      }
      mat4.mul(renderMatrix, renderMatrix, movePose);

      // volume Preview.
      views[activeView].updateView(renderMatrix);

      requestAnimationFrame(animate);
    }

    function reset() {
      views.forEach(function(e, i) {
        e.reset();
      });

      movePose = getInitialMovePose();
      mat4.identity(initialMatrix);
      isStaticViewpoint = false;
    }

    function resize(width, height) {
      mRenderWidth = width;
      mRenderHeight = height;
      views.forEach(function(e, i) {
        e.resize(width, height);
      });
    }

    function centerViewpoint() {
      movePose = getInitialMovePose();
    }

    function staticViewpoint() {
      isStaticViewpoint = !isStaticViewpoint;
    }

    function zoom(isZoomIn) {
      var delta = 0.2;
      if (!isZoomIn) delta *= -1;

      var incrementMatrix = SPMath.mat4FromCameraPose([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, delta]);
      mat4.mul(movePose, incrementMatrix, movePose);
    }

    // Export the object;
    this.init = init;
    this.toggleView = toggleView;
    this.updateView = updateView;
    this.updateMeshes = function(e) {
      views[0].updateMeshes();
    };
    this.reset = reset;
    this.resize = resize;
    this.centerViewpoint = centerViewpoint;
    this.staticViewpoint = staticViewpoint;
    this.zoomIn = function(ev) { zoom(true); };
    this.zoomOut = function(ev) { zoom(false); };
  }

  /**
   * VolumePreview constructor.
   */
  function VolumePreview(sp, stats, spDom) {
    var canvas = spDom.$$('#volumePreviewRender');
    var mStyleWidth, mStyleHeight;
    var context = canvas.getContext('2d');
    var imageData = context.createImageData(SP_SIZE_WIDTH, SP_SIZE_HEIGHT);
    var gettingVolumePreview = false;
    var showing = (canvas.style.display == 'none') ? false : true;
    var lastFrameError = false;

    resize(SP_SIZE_WIDTH, SP_SIZE_HEIGHT);

    function resize(width, height) {
      canvas.width = SP_SIZE_WIDTH;
      canvas.height = SP_SIZE_HEIGHT;
      canvas.style.width = width;
      canvas.style.height = height;
      mStyleWidth = width;
      mStyleHeight = height;
    }

    function updateView(renderMatrix) {
      if (!showing || gettingVolumePreview) return;

      gettingVolumePreview = true;
      sp.queryVolumePreview(SPMath.mat4ToCameraPose(renderMatrix)).then(function(image) {
        imageData.data.set(image.data);
        context.putImageData(imageData, 0, 0);
        gettingVolumePreview = false;
        stats.update();
        if (lastFrameError) {
          var msg = 'Volume preview image comes back.';
          if (spReconstructionSample.myStatus)
            myStatus.info(msg);
          else
            console.log(msg);
        }
      }, function(e) {
        gettingVolumePreview = false;
        lastFrameError = true;
        errorHandler(e);
      });
    }

    function showView(enabled) {
      if (enabled) {
        canvas.style.display = '';
        showing = true;
        resize(mStyleWidth, mStyleHeight);
      } else {
        canvas.style.display = 'none';
        showing = false;
      }
    }

    function reset() {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Export the object;
    this.updateView = updateView;
    this.showView = showView;
    this.reset = reset;
    this.resize = resize;
  }

  /**
   * MeshView definition.
   */
  function MeshView(sp, stats, spDom) {
    var canvas = spDom.$$('#meshRender');
    var myWidth = SP_SIZE_WIDTH;
    var myHeight = SP_SIZE_HEIGHT;
    var gl = canvas.getContext('webgl');
    var currentMeshes, meshToDraw, program;
    var modelViewMatrix = mat4.create();
    var projectionMatrix = mat4.create();
    var initialMatrix = mat4.create();
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
      var inverse = mat4.create();
      mat4.invert(inverse, renderMatrix);
      var mRot = mat4.fromValues(
          1.0, 0, 0, 0,
          0, -1.0, 0, 0,
          0, 0, -1.0, 0,
          0, 0, 0, 1.0);
      mat4.multiply(mRot, mRot, inverse);
      mat4.transpose(mRot, mRot);
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
      mat4.ortho(initialMatrix, 0, canvas.width, 0, canvas.height, -1, 1);
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

      gl.uniformMatrix4fv(
          program.mvMatrixUniform,
          false,
          SPMath.mat4ToRowIndexArray(modelViewMatrix));
      gl.uniformMatrix4fv(
          program.pMatrixUniform,
          false,
          SPMath.mat4ToRowIndexArray(projectionMatrix));

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

  // Exports elements.
  exports.RightRender = RightRender;
})(spReconstructionSample);
