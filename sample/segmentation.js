var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var takePhotoButton = document.getElementById('takePhoto');
var loadPhoto = document.getElementById('loadPhoto');
var saveButton = document.getElementById('save');
var segmentationButton = document.getElementById('segmentation');

var previewCanvas = document.getElementById('preview');
var imageCanvas = document.getElementById('image');
var overlayCanvas = document.getElementById('overlay');

var ep;
var previewContext, previewData, imageContext, imageData, overlayContext;
var currentPhoto, savePhoto;

var width = 640, height = 480;
var canvasWidth = 400, canvasHeight = 300;
var topX, topY, bottomX, bottomY;
var lastX, lastY;
var mouseDown = 0;
var hasImage = false;
var stopDrawLine = false;
var imgMarkups = [];

function doBlendColorPop(colorImage, maskImage) {
  var GREY = 0x7f;
  var alpha;
  for (var x = 0; x < colorImage.width; x++) {
    for (var y = 0; y < colorImage.height; y++) {
      var index = y * colorImage.width * 4 + x * 4;
      var maskIndex = y * maskImage.width + x;
      var mask = maskImage.data[maskIndex];
      if (mask > 0) alpha = 1.0;
      else alpha = 0.0;

      colorImage.data[index] = parseInt(alpha * colorImage.data[index] +
          (1 - alpha) * ((colorImage.data[index] >> 4) + GREY));
      colorImage.data[index + 1] = parseInt(alpha * colorImage.data[index + 1] +
          (1 - alpha) * ((colorImage.data[index + 1] >> 4) + GREY));
      colorImage.data[index + 2] = parseInt(alpha * colorImage.data[index + 2] +
          (1 - alpha) * ((colorImage.data[index + 2] >> 4) + GREY));
    }
  }
}

function main() {
  ep = realsense.EnhancedPhotography;

  previewContext = previewCanvas.getContext('2d');
  imageContext = imageCanvas.getContext('2d');
  overlayContext = overlay.getContext('2d');
  previewData = previewContext.createImageData(width, height);

  var gettingImage = false;

  overlayCanvas.addEventListener('mousedown', function(e) {
    if (!hasImage)
      return;
    mouseDown++;
    if (mouseDown == 1) {
      topX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
      topY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
    } else if (mouseDown == 2) {
      bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
      bottomY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
      ep.objectSegment(currentPhoto, { x: topX, y: topY }, { x: bottomX, y: bottomY }).then(
          function(maskImage) {
            var len = maskImage.width * maskImage.height;
            for (var i = 0; i < len; i++) {
              imgMarkups[i] = 0;
            }
            currentPhoto.queryReferenceImage().then(
                function(colorImage) {
                  doBlendColorPop(colorImage, maskImage);

                  imageContext.clearRect(0, 0, width, height);
                  imageData = imageContext.createImageData(
                      colorImage.width, colorImage.height);
                  imageData.data.set(colorImage.data);
                  imageContext.putImageData(imageData, 0, 0);

                  currentPhoto.clone().then(
                      function(photo) {
                        savePhoto = photo;
                        savePhoto.setColorImage(colorImage).then(
                            function() {
                              statusElement.innerHTML = 'Finish processing segmentation!' +
                                  'Click and drag the left(foregroud) and right(background)' +
                                  'mouse buttons to refine the mask';
                            },
                            function(e) { statusElement.innerHTML = e; });
                      },
                      function(e) { statusElement.innerHTML = e; });
                },
                function(e) { statusElement.innerHTML = e });
          },
          function(e) { statusElement.innerHTML = e });
    } else {
      stopDrawLine = false;
      // Image markup
      var x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
      var y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
      // makeUpImage({x: x, y: y}, true);
      overlayContext.beginPath();
      if (e.button == 0) {
        overlayContext.strokeStyle = 'blue';
        imgMarkups[y * width + x] = 1;
      } else {
        overlayContext.strokeStyle = 'green';
        imgMarkups[y * width + x] = 2;
      }
      overlayContext.lineWidth = 0.5;
      overlayContext.moveTo(x, y);
      lastX = x;
      lastY = y;
    }
  }, false);

  overlayCanvas.addEventListener('mousemove', function(e) {
    bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
    bottomY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
    if (mouseDown == 1) {
      overlayContext.clearRect(0, 0, width, height);
      var offsetX = bottomX - topX;
      var offsetY = bottomY - topY;
      overlayContext.strokeStyle = 'red';
      overlayContext.lineWidth = 2;
      overlayContext.strokeRect(topX, topY, offsetX, offsetY);
    } else if (mouseDown > 2) {
      var value = e.button == 0 ? 1 : 2;
      if (!stopDrawLine) {
        overlayContext.lineTo(bottomX, bottomY);
        overlayContext.stroke();
        // for precessing
        if (lastX == bottomX) {
          for (var y = lastY; y != bottomY; y += (lastY < bottomY) ? 1 : -1)
          {
            imgMarkups[y * width + lastX] = value;
          }
        } else {
          var slope = (bottomY - lastY) / (bottomX - lastX);

          for (var x = lastX; x != bottomX; x += (lastX < bottomX) ? 1 : -1)
          {
            var y = parseInt((slope * (x - lastX) + lastY) + 0.5);

            imgMarkups[y * width + x] = value;
          }
        }

        lastX = bottomX;
        lastY = bottomY;
      } else {
        overlayContext.closePath();
      }

    }
  }, false);

  overlayCanvas.addEventListener('mouseup', function(e) {
    if (mouseDown > 2) {
      stopDrawLine = true;
      var markupImage = {
        format: 'Y8',
        width: width,
        height: height,
        data: imgMarkups
      };
      ep.refineMask(markupImage).then(
          function(maskImage) {
            currentPhoto.queryReferenceImage().then(
                function(colorImage) {
                  doBlendColorPop(colorImage, maskImage);

                  imageContext.clearRect(0, 0, width, height);
                  imageData = imageContext.createImageData(
                      colorImage.width, colorImage.height);
                  imageData.data.set(colorImage.data);
                  imageContext.putImageData(imageData, 0, 0);

                  currentPhoto.clone().then(
                      function(photo) {
                        savePhoto = photo;
                        savePhoto.setColorImage(colorImage).then(
                            function() {
                              statusElement.innerHTML = 'Click and drag the left(foregroud) and' +
                              'right(background) mouse buttons to refine the mask';
                            },
                            function(e) { statusElement.innerHTML = e; });
                      },
                      function(e) { statusElement.innerHTML = e; });
                },
                function() { });
          },
          function(e) { statusElement.innerHTML += e; });
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
    ep.takeSnapShot().then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                imageData =
                    imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Select the bounding box around the object.';
                overlayContext.clearRect(0, 0, width, height);
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
    ep.saveDepthPhoto(savePhoto).then(
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
    ep.loadDepthPhoto(file).then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                imageContext.clearRect(0, 0, width, height);
                imageData = imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Select the bounding box around the object.';
                overlayContext.clearRect(0, 0, width, height);
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

  segmentationButton.onclick = function(e) {
    overlayContext.clearRect(0, 0, width, height);
    mouseDown = 0;
    currentPhoto.queryReferenceImage().then(
        function(image) {
          imageContext.clearRect(0, 0, width, height);
          imageData =
              imageContext.createImageData(image.width, image.height);
          statusElement.innerHTML = 'Select the bounding box around the object.';
          overlayContext.clearRect(0, 0, width, height);
          imageData.data.set(image.data);
          imageContext.putImageData(imageData, 0, 0);
          hasImage = true;
        },
        function(e) { statusElement.innerHTML += e; });
  };
}
