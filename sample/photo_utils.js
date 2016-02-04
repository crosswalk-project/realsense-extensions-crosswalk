var loadPhoto = document.getElementById('loadPhoto');
var saveButton = document.getElementById('save');
var colorResizeRadio = document.getElementById('colorResize');
var commonFOVRadio = document.getElementById('commonFOV');
var depthResizeRadio = document.getElementById('depthResize');
var enhanceDepthRadio = document.getElementById('enhanceDepth');
var depthQualityRadio = document.getElementById('depthQuality');
var photoCropRadio = document.getElementById('photoCrop');
var photoRotateRadio = document.getElementById('photoRotate');

var statusElement = document.getElementById('status');
var imageCanvas = document.getElementById('image');
var overlayCanvas = document.getElementById('overlay');

var imageContext, imageData;
var overlayContext;
var photoUtils, XDMUtils;
var currentPhoto, savePhoto;
var width, height;

const FirstClick = 0, SecondClick = 1;
var nextClick = FirstClick;
var topX, topY, bottomX, bottomY;
var hasImage = false;

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

function getDateString() {
  var date = new Date();
  var dateString =
      date.getFullYear() +
      ('0' + (date.getMonth() + 1)).slice(-2) +
      ('0' + date.getDate()).slice(-2) +
      ('0' + date.getHours()).slice(-2) +
      ('0' + date.getMinutes()).slice(-2) +
      ('0' + date.getSeconds()).slice(-2);
  return dateString;
}

function resetRadioButtons() {
  colorResizeRadio.checked = false;
  commonFOVRadio.checked = false;
  depthResizeRadio.checked = false;
  enhanceDepthRadio.checked = false;
  depthQualityRadio.checked = false;
  photoCropRadio.checked = false;
  photoRotateRadio.checked = false;
}

function fillCanvasUsingColorImage(image) {
  imageContext.clearRect(0, 0, width, height);
  imageData = imageContext.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  imageContext.putImageData(imageData, 0, 0);
}

function fillCanvasUsingDepthImage(image) {
  imageContext.clearRect(0, 0, width, height);
  imageData = imageContext.createImageData(image.width, image.height);
  ConvertDepthToRGBUsingHistogram(
      image, [255, 255, 255], [0, 0, 0], imageData.data);
  imageContext.putImageData(imageData, 0, 0);
}

function colorResize() {
  photoUtils.colorResize(currentPhoto, 1280).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              fillCanvasUsingColorImage(image);
              statusElement.innerHTML = 'colorResize success.';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function commonFOV() {
  photoUtils.commonFOV(currentPhoto).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              fillCanvasUsingColorImage(image);
              statusElement.innerHTML = 'commonFOV success.';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function depthEnhance() {
  photoUtils.enhanceDepth(currentPhoto, 'low').then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepth().then(
            function(image) {
              fillCanvasUsingDepthImage(image);
              statusElement.innerHTML = 'enhanceDepth success.';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function depthResize() {
  photoUtils.depthResize(currentPhoto, 640).then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepth().then(
            function(image) {
              fillCanvasUsingDepthImage(image);
              statusElement.innerHTML = 'depthResize success.';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function depthQuality() {
  photoUtils.getDepthQuality(currentPhoto).then(
      function(quality) {
        statusElement.innerHTML = 'Depth qulity = ' + quality;
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function photoCrop() {
  var startX = Math.min(topX, bottomX);
  var startY = Math.min(topY, bottomY);
  var endX = Math.max(topX, bottomX);
  var endY = Math.max(topY, bottomY);
  photoUtils.photoCrop(currentPhoto,
                       { x: startX,
                         y: startY,
                         w: (endX - startX),
                         h: (endY - startY)}).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              overlayContext.clearRect(0, 0, width, height);
              fillCanvasUsingColorImage(image);
              statusElement.innerHTML = 'photoCrop success';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function photoRotate() {
  photoUtils.photoRotate(currentPhoto, 90.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryContainerImage().then(
            function(image) {
              fillCanvasUsingColorImage(image);
              statusElement.innerHTML = 'photoRotate success';
            },
            function(e) { statusElement.innerHTML = e.message; });
      },
      function(e) { statusElement.innerHTML = e.message; });
}

function main() {
  photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;
  XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

  imageContext = imageCanvas.getContext('2d');
  overlayContext = overlay.getContext('2d');

  colorResizeRadio.addEventListener('click', function(e) {
    if (colorResizeRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      colorResize();
    }
  }, false);

  commonFOVRadio.addEventListener('click', function(e) {
    if (commonFOVRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      commonFOV();
    }
  }, false);

  enhanceDepthRadio.addEventListener('click', function(e) {
    if (enhanceDepthRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      depthEnhance();
    }
  }, false);

  depthResizeRadio.addEventListener('click', function(e) {
    if (depthResizeRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      depthResize();
    }
  }, false);

  depthQualityRadio.addEventListener('click', function(e) {
    if (depthQualityRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      depthQuality();
    }
  }, false);

  photoCropRadio.addEventListener('click', function(e) {
    if (photoCropRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      currentPhoto.queryContainerImage().then(
          function(image) {
            fillCanvasUsingColorImage(image);
            statusElement.innerHTML = 'Please select the cropped field.';
          },
          function(e) { statusElement.innerHTML = e.message; });
    }
  }, false);

  photoRotateRadio.addEventListener('click', function(e) {
    if (photoRotateRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      photoRotate();
    }
  }, false);

  overlayCanvas.addEventListener('mousedown', function(e) {
    if (!hasImage || !photoCropRadio.checked)
      return;
    if (nextClick == FirstClick) {
      topX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
      topY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / imageCanvas.scrollHeight);
      nextClick = SecondClick;
    } else if (nextClick == SecondClick) {
      bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
      bottomY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / imageCanvas.scrollHeight);
      nextClick = FirstClick;
      photoCrop();
    }
  }, false);

  overlayCanvas.addEventListener('mousemove', function(e) {
    bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
    bottomY = parseInt((e.clientY - overlayCanvas.offsetTop) * height / imageCanvas.scrollHeight);
    if (nextClick == SecondClick) {
      overlayContext.clearRect(0, 0, width, height);
      var offsetX = bottomX - topX;
      var offsetY = bottomY - topY;
      overlayContext.strokeStyle = 'red';
      overlayContext.lineWidth = 2;
      overlayContext.strokeRect(topX, topY, offsetX, offsetY);
    }
  }, false);

  loadPhoto.addEventListener('change', function(e) {
    var file = loadPhoto.files[0];
    XDMUtils.isXDM(file).then(
        function(success) {
          if (success) {
            XDMUtils.loadXDM(file).then(
                function(photo) {
                  currentPhoto = photo;
                  savePhoto = photo;
                  currentPhoto.queryContainerImage().then(
                      function(image) {
                        resetRadioButtons();
                        width = image.width;
                        height = image.height;
                        imageCanvas.width = width;
                        imageCanvas.height = height;
                        overlayCanvas.width = width;
                        overlayCanvas.height = height;
                        fillCanvasUsingColorImage(image);
                        statusElement.innerHTML = 'Load successfully.';
                        hasImage = true;
                        photoUtils.getDepthQuality(currentPhoto).then(
                            function(quality) {
                              statusElement.innerHTML += ' The photo quality is ' + quality;
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

  saveButton.onclick = function(e) {
    if (!savePhoto) {
      statusElement.innerHTML = 'There is no photo to save';
      return;
    }
    XDMUtils.saveXDM(savePhoto).then(
        function(blob) {
          xwalk.experimental.native_file_system.requestNativeFileSystem('pictures',
              function(fs) {
                var fileName = '/pictures/depthphoto_' + getDateString() + '.jpg';
                fs.root.getFile(fileName, { create: true }, function(entry) {
                  entry.createWriter(function(writer) {
                    writer.onwriteend = function(e) {
                      statusElement.innerHTML =
                          'The depth photo has been saved to ' + fileName + ' successfully.';
                    };
                    writer.onerror = function(e) {
                      statusElement.innerHTML = 'Failed to save depth photo.';
                    };
                    writer.write(blob);
                  },
                  function(e) { statusElement.innerHTML = e; });
                },
                function(e) { statusElement.innerHTML = e; });
              });
        },
        function(e) { statusElement.innerHTML = e.message; });
  };
}
