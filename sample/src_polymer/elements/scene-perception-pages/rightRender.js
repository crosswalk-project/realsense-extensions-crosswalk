function RightRender(sp, spDom) {
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
  var activeView = 0;
  var started = false;
  var isStaticViewpoint = false;

  function init() {
    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '25px';
    stats.domElement.style.right = '25px';
    stats.domElement.style.zIndex = '100';
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
    var matrix = new THREE.Matrix4();
    matrix.fromCameraPose([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, -volumeDimension]);
    return matrix;
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
      initialMatrix.fromCameraPose(currentPose);
    }
    var renderMatrix = initialMatrix.clone();
    // For meshView.
    if (activeView == 0) {
      renderMatrix.multiply(translationMatrix);
    }
    renderMatrix = renderMatrix.multiply(movePose);

    // volume Preview.
    views[activeView].updateView(renderMatrix);

    requestAnimationFrame(animate);
  }

  function reset() {
    views.forEach(function(e, i) {
      e.reset();
    });

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

  function zoom(isZoomIn) {
    var incrementMatrix = new THREE.Matrix4();
    var delta = 0.2;
    if (!isZoomIn) delta *= -1;

    incrementMatrix.fromCameraPose([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, delta]);
    incrementMatrix.multiply(movePose);
    movePose = incrementMatrix;
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
