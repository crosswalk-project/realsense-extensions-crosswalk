var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var takePhotoButton = document.getElementById('takePhoto');
var loadPhoto = document.getElementById('loadPhoto');

var previewCanvas = document.getElementById('preview');
var imageCanvas = document.getElementById('image');

var ep;
var previewContext, previewData, imageContext, imageData;

var width = 640, height = 480;
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
  if (!hasImage || !isInitialized)
    return;

  ep.applyMotionEffect({ horizontal: right, vertical: up, distance: forward },
                       { pitch: pitch, yaw: yaw, roll: roll },
                       zoom).then(
      function(image) {
        statusElement.innerHTML = 'Finished MotionEffects';
        imageData.data.set(image.data);
        imageContext.putImageData(imageData, 0, 0);
      },
      function(e) { statusElement.innerHTML = e; });
}

function main() {
  ep = realsense.EnhancedPhotography;

  previewContext = previewCanvas.getContext('2d');
  imageContext = imageCanvas.getContext('2d');
  previewData = previewContext.createImageData(width, height);

  var gettingImage = false;
  ep.onpreview = function(e) {
    if (gettingImage)
      return;
    gettingImage = true;
    ep.getPreviewImage().then(
        function(image) {
          previewData.data.set(image.data);
          previewContext.putImageData(previewData, 0, 0);
          gettingImage = false;
        }, function() { });
  };

  ep.onerror = function(e) {
    statusElement.innerHTML = 'Status Info : onerror: ' + e.status;
  };

  startButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Start: ';
    gettingImage = false;
    ep.startPreview().then(function(e) { statusElement.innerHTML += e; },
                           function(e) { statusElement.innerHTML += e; });
  };

  takePhotoButton.onclick = function(e) {
    ep.takeSnapShot().then(
        function(photo) {
          photo.queryReferenceImage().then(
              function(image) {
                imageData =
                    imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Take photo sucessfully';
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;

                ep.initMotionEffect(photo).then(
                    function() {
                      isInitialized = true;
                      doMothionEffect();
                    },
                    function(e) { statusElement.innerHTML = e });
              },
              function(e) { statusElement.innerHTML = e; });
        },
        function(e) { statusElement.innerHTML = e; });
  };

  loadPhoto.addEventListener('change', function(e) {
    var file = loadPhoto.files[0];
    ep.loadDepthPhoto(file).then(
        function(photo) {
          photo.queryReferenceImage().then(
              function(image) {
                imageContext.clearRect(0, 0, width, height);
                imageData = imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Load sucessfully';
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;
                ep.initMotionEffect(photo).then(
                    function() {
                      isInitialized = true;
                      doMothionEffect();
                    },
                    function(e) { statusElement.innerHTML = e });
              },
              function(e) { statusElement.innerHTML = e; });
        },
        function(e) { statusElement.innerHTML = e; });
  });

  stopButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Stop: ';
    ep.stopPreview().then(function(e) { statusElement.innerHTML += e; },
                          function(e) { statusElement.innerHTML += e; });
  };
}
