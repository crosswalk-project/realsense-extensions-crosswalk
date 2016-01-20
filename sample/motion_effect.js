var statusElement = document.getElementById('status');
var loadPhoto = document.getElementById('loadPhoto');
var imageCanvas = document.getElementById('image');

var motionEffect, photoUtils, XDMUtils;
var imageContext, imageData;

var width = 1920, height = 1080;
var yaw = 0.0, pitch = 0.0, roll = 0.0, zoom = 0.0;
var right = 0.0, up = 0.0, forward = 0.0;

var hasImage = false;
var isInitialized = false;

function outputRightUpdate(value) {
  right = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputUpUpdate(value) {
  up = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputforwardUpdate(value) {
  forward = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputYawUpdate(value) {
  yaw = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputPitchUpdate(value) {
  pitch = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputRollUpdate(value) {
  roll = parseInt(value) * 0.2;
  doMothionEffect();
}

function outputZoomUpdate(value) {
  zoom = parseInt(value) * 0.2 * 0.2;
  doMothionEffect();
}

function doMothionEffect() {
  if (!hasImage || !isInitialized || !motionEffect)
    return;

  motionEffect.apply({ horizontal: right, vertical: up, distance: forward },
                     { pitch: pitch, yaw: yaw, roll: roll },
                     zoom).then(
      function(image) {
        statusElement.innerHTML = 'Finished MotionEffects';
        imageData.data.set(image.data);
        imageContext.putImageData(imageData, 0, 0);
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function main() {
  photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;
  XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

  imageContext = imageCanvas.getContext('2d');

  loadPhoto.addEventListener('change', function(e) {
    var file = loadPhoto.files[0];
    XDMUtils.isXDM(file).then(
        function(success) {
          if (success) {
            XDMUtils.loadXDM(file).then(
                function(photo) {
                  photo.queryContainerImage().then(
                      function(image) {
                        imageContext.clearRect(0, 0, width, height);
                        imageData = imageContext.createImageData(image.width, image.height);
                        statusElement.innerHTML = 'Load successfully.';
                        imageData.data.set(image.data);
                        imageContext.putImageData(imageData, 0, 0);
                        hasImage = true;

                        photoUtils.getDepthQuality(photo).then(
                            function(quality) {
                              statusElement.innerHTML += ' The photo quality is ' + quality;

                              if (!motionEffect) {
                                try {
                                  motionEffect =
                                      new realsense.DepthEnabledPhotography.MotionEffect();
                                } catch (e) {
                                  statusElement.innerHTML = e.message;
                                  return;
                                }
                              }
                              motionEffect.init(photo).then(
                                  function() {
                                    isInitialized = true;
                                    doMothionEffect();
                                  },
                                  function(e) {
                                    statusElement.innerHTML =
                                        'The photo quality is ' + quality + '. ' + e.message;
                                  });
                            },
                            function(e) { statusElement.innerHTML = e.message; });
                      },
                      function(e) { statusElement.innerHTML = e.message; });
                },
                function(e) { statusElement.innerHTML = e.message; });
          } else {
            statusElement.innerHTML = 'This is not a XDM file. Load failed.';
          }
        },
        function(e) { statusElement.innerHTML = e.message; });
  });
}
