var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var takePhotoButton = document.getElementById('takePhoto');
var loadPhoto = document.getElementById('loadPhoto');
var saveButton = document.getElementById('save');
var depthBlendButton = document.getElementById('depthBlend');

var fileInput = document.getElementById('fileInput');
var fileDisplayArea = document.getElementById('fileDisplayArea');

var yawValueLabel = document.getElementById('yaw_value');
var pitchValueLabel = document.getElementById('pitch_value');
var rollValueLabel = document.getElementById('roll_value');
var zoffsetValueLabel = document.getElementById('zoffset_value');

var previewCanvas = document.getElementById('preview');
var imageCanvas = document.getElementById('image');
var overlayCanvas = document.getElementById('overlay');

var ep;
var previewContext, previewData, imageContext, imageData;
var currentPhoto, savePhoto;

var width = 640, height = 480;
var canvasWidth = 400, canvasHeight = 300;
var x = -1, y = -1;
var yaw = -1, pitch = -1, roll = -1, zoffset = -1;
var hasBlendImage = false;
var blendImage, blendImageData;
var sticker;
var depthValue;
var insertDepth;

var hasImage = false;
var isDepthBlend = false;

function outputYawUpdate(value) {
  yawValueLabel.value = value;
  yaw = parseInt(value);
  doDepthBlend();
}

function outputPitchUpdate(value) {
  pitchValueLabel.value = value;
  pitch = parseInt(value);
  doDepthBlend();
}

function outputRollUpdate(value) {
  rollValueLabel.value = value;
  roll = parseInt(value);
  doDepthBlend();
}

function outputZoffetUpdate(value) {
  zoffsetValueLabel.value = value;
  zoffset = parseInt(value);
  doDepthBlend();
}

function doDepthBlend() {
  if (!currentPhoto)
    return;

  if (!hasBlendImage)
    return;

  if (!depthValue)
    return;

  insertDepth = depthValue + zoffset;

  ep.depthBlend(currentPhoto, sticker,
                { x: x, y: y },
                insertDepth,
                { pitch: pitch, yaw: yaw, roll: roll },
                1.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryReferenceImage().then(
            function(image) {
              statusElement.innerHTML = 'Finished blending. Click again!';
              imageData.data.set(image.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthBlend(e) {
  if (!hasImage || !hasBlendImage)
    return;

  x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
  y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);

  var clickX = x;
  var clickY = y;
  currentPhoto.queryRawDepthImage().then(
      function(depth) {
        currentPhoto.queryOriginalImage().then(
            function (color) {
              clickX *= (depth.width / color.width);
              clickY *= (depth.height / color.height);

              clickX = parseInt(clickX);
              clickY = parseInt(clickY);

              if (clickX >= 0 && clickX < depth.width &&
                  clickY >= 0 && clickY < depth.height) {
                depthValue = depth.data[clickY * depth.width + clickX];
              } else {
                return;
              }

              if (depthValue) {
                doDepthBlend();
              } else {
                statusElement.innerHTML =
                    'Insert depth value is 0. Please select another point.';
                return;
              }
            },
          function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function main() {
  fileInput.addEventListener('change', function(e) {
    var file = fileInput.files[0];
    var imageType = /image.*/;

    if (file.type.match(imageType)) {
      var reader = new FileReader();

      reader.onload = function(e) {
        fileDisplayArea.src = reader.result;

        blendImage = new Image();
        blendImage.src = reader.result;

        var tempCanvas = document.createElement('canvas');
        var tempContext = tempCanvas.getContext('2d');
        tempContext.drawImage(blendImage, 0, 0);
        blendImageData = tempContext.getImageData(0, 0, blendImage.width, blendImage.height);

        sticker = {
          format: 'RGB32',
          width: blendImage.width,
          height: blendImage.height,
          data: blendImageData.data
        };

        hasBlendImage = true;
        if (hasImage && isDepthBlend)
          statusElement.innerHTML = 'Select a point on photo to Blend';
      };

      reader.readAsDataURL(file);
    } else {
      statusElement.innerHTML = 'File not supported!';
    }
  });

  ep = realsense.EnhancedPhotography.EnhancedPhoto;

  previewContext = previewCanvas.getContext('2d');
  imageContext = imageCanvas.getContext('2d');
  previewData = previewContext.createImageData(width, height);

  var gettingImage = false;

  overlayCanvas.addEventListener('mousedown', function(e) {
    if (isDepthBlend) {
      depthBlend(e);
    }
  }, false);

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
    statusElement.innerHTML = 'Status Info : TakeSnapshot: ';
    ep.takeSnapShot().then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                imageData =
                    imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;
              },
              function(e) { statusElement.innerHTML += e; });
        },
        function(e) { statusElement.innerHTML += e; });
  };

  saveButton.onclick = function(e) {
    if (!savePhoto) {
      statusElement.innerHTML = 'There is no photo to save';
      return;
    }
    savePhoto.saveXDM().then(
        function(blob) {
          var reader = new FileReader();
          reader.onload = function(evt) {
            var image = document.getElementById('imageDisplayArea');
            image.src = evt.target.result;
            // Currently, crosswalk has bugs to download (see XWALK-5220). So the following code
            // doesn't work. Once download is enabled. The processed image will be
            // downloaded into 'Downloads' folder.
            var a = document.createElement('a');
            a.href = evt.target.result;
            a.download = true;
            a.click();
            statusElement.innerHTML = 'Save successfully';
          };
          reader.readAsDataURL(blob);
        },
        function(e) { statusElement.innerHTML = e; });
  };

  loadPhoto.addEventListener('change', function(e) {
    var file = loadPhoto.files[0];
    var dp = new realsense.EnhancedPhotography.DepthPhoto();
    dp.loadXDM(file).then(
        function(sucess) {
          currentPhoto = dp;
          savePhoto = dp;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                imageContext.clearRect(0, 0, width, height);
                imageData = imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Load successfully';
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;
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

  depthBlendButton.onclick = function(e) {
    if (!hasImage) {
      statusElement.innerHTML = 'There is no image to process';
      return;
    }

    isDepthBlend = true;

    if (!hasBlendImage) {
      statusElement.innerHTML = 'Load an image to blend';
      return;
    }
    currentPhoto.queryReferenceImage().then(
        function(image) {
          imageContext.clearRect(0, 0, width, height);
          imageData = imageContext.createImageData(image.width, image.height);
          imageData.data.set(image.data);
          imageContext.putImageData(imageData, 0, 0);
        },
        function(e) { statusElement.innerHTML += e; });
    statusElement.innerHTML = 'Select a point on photo to Blend';
  };
}
