function RightRender(sp) {
  var stats, currentPose;
  var volumeDimension = 4;
  var mRenderWidth = 320;
  var mRenderHeight = 240;
  var movePose = new THREE.Matrix4();
  var initialMatrix = new THREE.Matrix4();
  var translationMatrix = new THREE.Matrix4();
  translationMatrix.makeTranslation(-0.5, 0.5, 0);
  translationMatrix.elements[15] *= Math.sqrt(window.devicePixelRatio);
  var views = [];
  var activeView = 1;
  var started = false;
  var extendReconstruction = true;
  var isStaticViewpoint = false;

  function init() {
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    stats.domElement.style.right = CONTROL_PANEL_WIDTH + CONTROL_PANEL_MARGIN;
    stats.domElement.style.zIndex = '100';
    document.getElementById('rightContainer').appendChild(stats.domElement);
    updateRelatedText();

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

    views = [new VolumePreview(sp, stats), new MeshView(sp, stats)];
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
    var matrix = new THREE.Matrix4();
    matrix.fromCameraPose([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, -volumeDimension]);
    return matrix;
  }

  function bindMouseEvent() {
    var container = document.getElementById('rightContainer');
    var onDrag = false;
    var startX = -1;
    var startY = -1;

    container.onmousedown = function(e) {
      var x = e.clientX;
      var y = e.clientY;
      var rect = e.target.getBoundingClientRect();
      if (rect.left <= x && x < rect.right &&
          rect.top <= y && y < rect.bottom) {
        startX = e.clientX;
        startY = e.clientY;
        onDrag = true;
      } else {
        startX = -1;
        startY = -1;
      }
    };
    container.onmouseup = function(e) {
      onDrag = false;
    };
    container.onmousemove = function(e) {
      if (startX == -1 && startY == -1) return;

      var x = e.clientX;
      var y = e.clientY;
      if (onDrag) {
        var anglex = 0.5 * (x - startX) / mRenderWidth;
        var angley = -0.5 * (y - startY) / mRenderHeight;
        var incrementMatrixX = new THREE.Matrix4();
        incrementMatrixX.fromCameraPose([
          Math.cos(anglex), 0, Math.sin(anglex), 0,
          0, 1, 0, 0,
          -Math.sin(anglex), 0, Math.cos(anglex), 0
        ]);

        var incrementMatrixY = new THREE.Matrix4();
        incrementMatrixY.fromCameraPose([
          1, 0, 0, 0,
          0, Math.cos(angley), -Math.sin(angley), 0,
          0, Math.sin(angley), Math.cos(angley), 0
        ]);
        incrementMatrixX.multiply(incrementMatrixY);
        incrementMatrixX.multiply(movePose);
        movePose = incrementMatrixX;
      }
      startX = x;
      startY = y;
    };
  }

  function toggleView() {
    views[activeView].showView(false);
    activeView = (activeView + 1) % views.length;
    views[activeView].showView(true);
    updateRelatedText();
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
      initialMatrix.fromCameraPose(currentPose);
    }
    var renderMatrix = initialMatrix.clone();
    // For meshView.
    if (activeView == 1) {
      renderMatrix.multiply(translationMatrix);
    }
    renderMatrix = renderMatrix.multiply(movePose);

    // volume Preview.
    views[activeView].updateView(renderMatrix);

    requestAnimationFrame(animate);
  }

  function updateRelatedText() {
    var meshId = getButtonValueId('toggleMeshRender');
    var reconstructionId = getButtonValueId('toggleExtend');
    document.getElementById(meshId).innerText = activeView;
    document.getElementById(reconstructionId).innerText = extendReconstruction ? 1 : 0;
  }

  function toggleExtend() {
    sp.isReconstructionEnabled().then(function(enabled) {
      if (extendReconstruction == enabled) {
        extendReconstruction = enabled;
        updateRelatedText();
      }
      sp.enableReconstruction(!enabled).then(function() {
        extendReconstruction = enabled;
        updateRelatedText();
        Status.info('Toggle reconstruction succeeds');
      }, errorHandler);
    }, errorHandler);
  }

  function reset() {
    views.forEach(function(e, i) {
      e.reset();
    });

    if (!extendReconstruction) toggleExtend();

    movePose = getInitialMovePose();
    initialMatrix.identity();
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
  // Export the object;
  this.init = init;
  this.toggleExtend = toggleExtend;
  this.toggleView = toggleView;
  this.updateView = updateView;
  this.updateMeshes = function(e) {
    views[1].updateMeshes();
  };
  this.reset = reset;
  this.resize = resize;
  this.centerViewpoint = centerViewpoint;
  this.staticViewpoint = staticViewpoint;
}
