var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var snapShotButton = document.getElementById('snapshot');
var loadPhoto = document.getElementById('loadPhoto');
var saveButton = document.getElementById('save');
var fileInput = document.getElementById('fileInput');
var measureRadio = document.getElementById('measure');
var refocusRadio = document.getElementById('refocus');
var depthEnhanceRadio = document.getElementById('depthEnhance');
var depthUpscaleRadio = document.getElementById('depthUpscale');
var photoCropRadio = document.getElementById('photoCrop');
var photoRotateRadio = document.getElementById('photoRotate');
var pasteOnPlaneRadio = document.getElementById('pastOnPlane');
var popColorRadio = document.getElementById('popColor');

var previewCanvas = document.getElementById('preview');
var imageCanvas = document.getElementById('image');
var overlayCanvas = document.getElementById('overlay');

var previewContext, previewData, imageContext, imageData;
var overlayContext;
var ep, paster, photoCapture, photoUtils;
var currentPhoto, savePhoto;
var width = 640, height = 480;
var canvasWidth = 400, canvasHeight = 300;

var clickCount = 0;
var startX = 0;
var startY = 0;
var endX = 0, endY = 0;
var hasImage = false;
var sticker;
var hasSelectPoints = false;

function ConvertDepthToRGBUsingHistogram(
    depthImage, nearColor, farColor, rgbImage) {
  var depthImageData = depthImage.data;
  var imageSize = depthImage.width * depthImage.height;
  for (var l = 0; l < imageSize; ++l) {
    rgbImage[l * 4] = 0;
    rgbImage[l * 4 + 1] = 0;
    rgbImage[l * 4 + 2] = 0;
    rgbImage[l * 4 + 3] = 255;
  }
  // Produce a cumulative histogram of depth values
  var histogram = new Int32Array(256 * 256);
  for (var i = 0; i < imageSize; ++i) {
    if (depthImageData[i]) {
      ++histogram[depthImageData[i]];
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
    if (depthImageData[l]) { // For valid depth values (depth > 0)
      // Use the histogram entry (in the range of 0..256) to interpolate between nearColor and
      // farColor
      var t = histogram[depthImageData[l]];
      rgbImage[l * 4] = ((256 - t) * nearColor[0] + t * farColor[0]) >> 8;
      rgbImage[l * 4 + 1] = ((256 - t) * nearColor[1] + t * farColor[1]) >> 8;
      rgbImage[l * 4 + 2] = ((256 - t) * nearColor[2] + t * farColor[2]) >> 8;
      rgbImage[l * 4 + 3] = 255;
    }
  }
}

function drawCross(x, y) {
  overlayContext.beginPath();
  overlayContext.strokeStyle = 'blue';
  overlayContext.lineWidth = 2;
  overlayContext.moveTo(x - 7, y - 7);
  overlayContext.lineTo(x + 7, y + 7);
  overlayContext.stroke();
  overlayContext.moveTo(x + 7, y - 7);
  overlayContext.lineTo(x - 7, y + 7);
  overlayContext.stroke();
  overlayContext.closePath();
}

function measureDistance(e) {
  if (hasImage == false)
    return;

  clickCount = clickCount + 1;
  var x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
  var y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
  if (clickCount % 2 == 0) {
    drawCross(x, y);
    overlayContext.beginPath();
    overlayContext.moveTo(startX, startY);
    overlayContext.lineTo(x, y);
    overlayContext.strokeStyle = 'blue';
    overlayContext.lineWidth = 2;
    overlayContext.stroke();
    overlayContext.closePath();
    statusElement.innerHTML = 'Status Info : Measure: ';
    ep.measureDistance(currentPhoto, {x: startX, y: startY}, {x: x, y: y}).then(
        function(d) {
          statusElement.innerHTML += 'distance = ' +
              parseFloat(d.distance).toFixed(2) + ' millimeters';
          overlayContext.fillStyle = 'blue';
          overlayContext.font = 'bold 14px Arial';
          overlayContext.fillText(
              parseFloat(d.distance).toFixed(2) + ' mm',
              (startX + x) / 2, (startY + y) / 2 - 5);
        },
        function(e) { statusElement.innerHTML += e; });
  } else {
    overlayContext.clearRect(0, 0, width, height);
    drawCross(x, y);
    startX = x;
    startY = y;
  }
}

function depthRefocus(e) {
  if (hasImage == false)
    return;

  var x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
  var y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);

  overlayContext.clearRect(0, 0, width, height);
  drawCross(x, y);

  ep.depthRefocus(currentPhoto, { x: x, y: y }, 50.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              imageData = imageContext.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Depth refocus success. Please select focus point again.';
              overlayContext.clearRect(0, 0, width, height);
              imageData.data.set(image.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthEnhance() {
  photoUtils.enhanceDepth(currentPhoto, 'low').then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepthImage().then(
            function(image) {
              imageContext.clearRect(0, 0, width, height);
              imageData = imageContext.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Finished depth enhancing.';
              ConvertDepthToRGBUsingHistogram(
                  image, [255, 255, 255], [0, 0, 0], imageData.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthUpscale() {
  photoUtils.depthResize(currentPhoto, width).then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepthImage().then(
            function(image) {
              imageData = imageContext.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Finished depth upscaling.';
              ConvertDepthToRGBUsingHistogram(
                  image, [255, 255, 255], [0, 0, 0], imageData.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function photoCrop() {
  photoUtils.photoCrop(currentPhoto, {x: 100, y: 100, w: 80, h: 80}).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              imageData = imageContext.createImageData(image.width, image.height);
              statusElement.innerHTML = 'photoCrop success';
              overlayContext.clearRect(0, 0, width, height);
              imageData.data.set(image.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function photoRotate() {
  photoUtils.photoRotate(currentPhoto, 90.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              imageData = imageContext.createImageData(image.width, image.height);
              statusElement.innerHTML = 'photoRotate success';
              overlayContext.clearRect(0, 0, width, height);
              imageData.data.set(image.data);
              imageContext.putImageData(imageData, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function doPasteOnPlane() {
  if (!hasImage || !pasteOnPlaneRadio.checked || !paster)
    return;

  if (!hasSelectPoints) {
    statusElement.innerHTML =
        'Select two points on the image to paste the sticker.';
    return;
  }

  var coordX = parseInt((startX + endX) / 2);
  var coordY = parseInt((startY + endY) / 2);
  const PI = 3.14159265;
  var rotation = 90 - 180 / PI * Math.atan2((endY - startY), (endX - startX));
  var stickerData = {
    height: -1,
    rotation: rotation,
    isCenter: true
  };
  paster.setSticker(sticker, { x: coordX, y: coordY }, stickerData).then(
      function(success) {
        paster.paste().then(
            function(photo) {
              photo.queryContainerImage().then(
                  function(image) {
                    statusElement.innerHTML = 'Finished paste on plane.';
                    imageData.data.set(image.data);
                    imageContext.putImageData(imageData, 0, 0);
                  },
                  function(e) { statusElement.innerHTML = e; });
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function pasteOnPlane(e) {
  if (hasImage == false || !sticker)
    return;

  clickCount = clickCount + 1;
  endX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
  endY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);
  if (clickCount % 2 == 0) {
    drawCross(endX, endY);
    overlayContext.beginPath();
    overlayContext.moveTo(startX, startY);
    overlayContext.lineTo(endX, endY);
    overlayContext.strokeStyle = 'blue';
    overlayContext.lineWidth = 2;
    overlayContext.stroke();
    overlayContext.closePath();

    hasSelectPoints = true;
    doPasteOnPlane();
  } else {
    overlayContext.clearRect(0, 0, width, height);
    drawCross(endX, endY);
    startX = endX;
    startY = endY;
  }
}

function popColor(e) {
  if (hasImage == false)
    return;

  var x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / canvasWidth);
  var y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / canvasHeight);

  overlayContext.clearRect(0, 0, width, height);
  drawCross(x, y);

  ep.computeMaskFromCoordinate(currentPhoto, { x: x, y: y }).then(
      function(maskImage) {
        currentPhoto.queryContainerImage().then(
            function(colorImage) {
              for (var x = 0; x < colorImage.width; x++) {
                for (var y = 0; y < colorImage.height; y++) {
                  var index = y * colorImage.width * 4 + x * 4;
                  var maskIndex = y * maskImage.width + x;
                  var alpha = 1.0 - maskImage.data[maskIndex];

                  // BGR
                  var grey = 0.0722 * colorImage.data[index + 2] +
                      0.7152 * colorImage.data[index + 1] + 0.2126 * colorImage.data[index];

                  colorImage.data[index] =
                      parseInt(colorImage.data[index] * (1 - alpha) + grey * (alpha));
                  colorImage.data[index + 1] =
                      parseInt(colorImage.data[index + 1] * (1 - alpha) + grey * (alpha));
                  colorImage.data[index + 2] =
                      parseInt(colorImage.data[index + 2] * (1 - alpha) + grey * (alpha));
                }
              }

              imageContext.clearRect(0, 0, width, height);
              imageData = imageContext.createImageData(colorImage.width, colorImage.height);
              imageData.data.set(colorImage.data);
              imageContext.putImageData(imageData, 0, 0);

              currentPhoto.clone().then(
                  function(photo) {
                    savePhoto = photo;
                    savePhoto.setContainerImage(colorImage).then(
                        function() {
                          statusElement.innerHTML =
                              'Finish processing color pop, select again!';
                        },
                        function(e) { statusElement.innerHTML = e; });
                  },
                  function(e) { statusElement.innerHTML = e; });
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function main() {
  ep = realsense.DepthEnabledPhotography.EnhancedPhoto;
  photoCapture = realsense.DepthEnabledPhotography.PhotoCapture;
  photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;

  previewContext = previewCanvas.getContext('2d');
  imageContext = imageCanvas.getContext('2d');
  overlayContext = overlay.getContext('2d');

  fileInput.addEventListener('change', function(e) {
    var file = fileInput.files[0];
    var imageType = /image.*/;

    if (file.type.match(imageType)) {
      var reader = new FileReader();

      reader.onload = function(e) {
        var pastedImage = new Image();
        pastedImage.src = reader.result;

        var tempCanvas = document.createElement('canvas');
        var tempContext = tempCanvas.getContext('2d');
        tempContext.drawImage(pastedImage, 0, 0);
        var pastedImageData = tempContext.getImageData(
            0, 0, pastedImage.width, pastedImage.height);

        sticker = {
          format: 'RGB32',
          width: pastedImage.width,
          height: pastedImage.height,
          data: pastedImageData.data
        };

        doPasteOnPlane();
      };

      reader.readAsDataURL(file);
    } else {
      statusElement.innerHTML = 'File not supported!';
    }
  });

  measureRadio.addEventListener('click', function(e) {
    if (measureRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML = 'Select two points to measure distance.';
      overlayContext.clearRect(0, 0, width, height);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, width, height);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  refocusRadio.addEventListener('click', function(e) {
    if (refocusRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML = 'Select the refocus point.';
      overlayContext.clearRect(0, 0, width, height);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, width, height);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  depthEnhanceRadio.addEventListener('click', function(e) {
    if (depthEnhanceRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlayContext.clearRect(0, 0, width, height);
      depthEnhance();
    }
  }, false);

  depthUpscaleRadio.addEventListener('click', function(e) {
    if (depthUpscaleRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlayContext.clearRect(0, 0, width, height);
      depthUpscale();
    }
  }, false);

  photoCropRadio.addEventListener('click', function(e) {
    if (photoCropRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlayContext.clearRect(0, 0, width, height);
      photoCrop();
    }
  }, false);

  photoRotateRadio.addEventListener('click', function(e) {
    if (photoRotateRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlayContext.clearRect(0, 0, width, height);
      photoRotate();
    }
  }, false);

  pasteOnPlaneRadio.addEventListener('click', function(e) {
    if (pasteOnPlaneRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      if (!paster) {
        try {
          paster = new realsense.DepthEnabledPhotography.Paster(currentPhoto);
        } catch (e) {
          statusElement.innerHTML = e.message;
          paster = null;
          return;
        }
      }

      if (!sticker) {
        statusElement.innerHTML =
            'Please click [Choose file] button to load the pasted image.';
      } else {
        statusElement.innerHTML =
            'Select two points on the image to paste the sticker.';
      }

      overlayContext.clearRect(0, 0, width, height);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, width, height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  popColorRadio.addEventListener('click', function(e) {
    if (popColorRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML = 'Select the point to pop color.';
      overlayContext.clearRect(0, 0, width, height);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, width, height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  overlayCanvas.addEventListener('mousedown', function(e) {
    if (measureRadio.checked) {
      measureDistance(e);
    }
    if (refocusRadio.checked) {
      depthRefocus(e);
    }
    if (pasteOnPlaneRadio.checked) {
      pasteOnPlane(e);
    }
    if (popColorRadio.checked) {
      popColor(e);
    }
  }, false);

  previewData = previewContext.createImageData(width, height);

  var imageFPS = new Stats();
  imageFPS.domElement.style.position = 'absolute';
  imageFPS.domElement.style.top = '0px';
  imageFPS.domElement.style.right = '0px';
  document.getElementById('canvas_container').appendChild(imageFPS.domElement);

  var gettingImage = false;

  photoCapture.onpreview = function(e) {
    if (gettingImage)
      return;
    gettingImage = true;
    photoCapture.getPreviewImage().then(
        function(image) {
          previewData.data.set(image.data);
          previewContext.putImageData(previewData, 0, 0);
          imageFPS.update();
          gettingImage = false;
        }, function() {});
  };

  photoCapture.onerror = function(e) {
    statusElement.innerHTML = 'Status Info : onerror: ' + e.status;
  };

  startButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Start: ';
    gettingImage = false;
    photoCapture.startPreview().then(function(e) { statusElement.innerHTML += e; },
                                     function(e) { statusElement.innerHTML += e; });
  };

  snapShotButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : TakePhoto: ';
    photoCapture.takePhoto().then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryContainerImage().then(
              function(image) {
                imageData = imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                overlayContext.clearRect(0, 0, width, height);
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;
                if (depthEnhanceRadio.checked) {
                  depthEnhance();
                }
                if (depthUpscaleRadio.checked) {
                  depthUpscale();
                }
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
    var dp = new realsense.DepthEnabledPhotography.Photo();
    dp.loadXDM(file).then(
        function(sucess) {
          currentPhoto = dp;
          savePhoto = dp;
          currentPhoto.queryContainerImage().then(
              function(image) {
                imageContext.clearRect(0, 0, width, height);
                imageData = imageContext.createImageData(image.width, image.height);
                statusElement.innerHTML = 'Load successfully';
                overlayContext.clearRect(0, 0, width, height);
                imageData.data.set(image.data);
                imageContext.putImageData(imageData, 0, 0);
                hasImage = true;
                if (depthEnhanceRadio.checked) {
                  depthEnhance();
                }
                if (depthUpscaleRadio.checked) {
                  depthUpscale();
                }
              },
              function(e) { statusElement.innerHTML = e; });
        },
        function(e) { statusElement.innerHTML = e; });
  });

  stopButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Stop: ';
    photoCapture.stopPreview().then(function(e) { statusElement.innerHTML += e; },
                                    function(e) { statusElement.innerHTML += e; });
  };
}
