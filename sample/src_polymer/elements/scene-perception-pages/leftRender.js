function LeftRender(sp, spDom) {
  var renderer = spDom.$$('#imageRender');
  var sampleFps = new Stats();

  var sampleFlowController = new CmdFlowController(5);
  var views = ['color', 'depth'];
  var activeView = 0;

  function init() {
    resize(SP_SIZE_WIDTH, SP_SIZE_HEIGHT);
    renderer.height = SP_SIZE_HEIGHT;
    sampleFps.domElement.style.position = 'absolute';
    sampleFps.domElement.style.top = '25px';
    sampleFps.domElement.style.left = '25px';
    sampleFps.domElement.style.zIndex = '100';
    spDom.$$('#leftContainer').insertBefore(sampleFps.domElement, renderer);
  }

  function resize(width, height) {
    renderer.width = SP_SIZE_WIDTH;
    renderer.height = SP_SIZE_HEIGHT;
    renderer.style.width = width;
    renderer.style.height = height;
  }

  function toggleView(viewIndex) {
    if (viewIndex == activeView) return;

    activeView = viewIndex;
    updateView();
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

  function ConvertDepthToRGBUsingHistogram(
      depthImage, nearColor, farColor, rgbImage) {
    var imageSize = SP_SIZE_WIDTH * SP_SIZE_HEIGHT;
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

  function updateView() {
    if (!sampleFlowController.get())
      return;
    sp.getSample().then(function(sample) {
      var context = renderer.getContext('2d');
      var imageData = context.createImageData(SP_SIZE_WIDTH, SP_SIZE_HEIGHT);
      if (activeView == 1) {
        ConvertDepthToRGBUsingHistogram(
            sample.depth.data, [255, 0, 0], [20, 40, 255], imageData.data);
      } else {
        imageData.data.set(sample.color.data);
      }
      context.putImageData(imageData, 0, 0);
      sampleFps.update();
      sampleFlowController.release();
    }, errorHandler);
  }

  // Export the object;
  this.init = init;
  this.toggleView = toggleView;
  this.updateView = updateView;
  this.resize = resize;
}
