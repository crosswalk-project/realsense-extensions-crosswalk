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
        myStatus.info('Volume preview image comes back.');
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
