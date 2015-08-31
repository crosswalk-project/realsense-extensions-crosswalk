var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var snapShotButton = document.getElementById('snapshot');
var loadButton = document.getElementById('load');
var saveButton = document.getElementById('save');
var measureRadio = document.getElementById('measure');
var refocusRadio = document.getElementById('refocus');
var depthEnhanceRadio = document.getElementById('depthEnhance');
var depthUpscaleRadio = document.getElementById('depthUpscale');
var pasteOnPlaneRadio = document.getElementById('pastOnPlane');

var preview_canvas = document.getElementById('preview');
var image_canvas = document.getElementById('image');
var overlay_canvas = document.getElementById('overlay');

var preview_context, preview_data, image_context, image_data;
var overlay_context;
var ep;
var currentPhoto, savePhoto;
var width = 640, height = 480;
var canvas_width = 400, canvas_height = 300;

var click_count = 0;
var start_x = 0;
var start_y = 0;
var has_image = false;

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
  overlay_context.beginPath();
  overlay_context.strokeStyle = 'blue';
  overlay_context.lineWidth = 2;
  overlay_context.moveTo(x - 7, y - 7);
  overlay_context.lineTo(x + 7, y + 7);
  overlay_context.stroke();
  overlay_context.moveTo(x + 7, y - 7);
  overlay_context.lineTo(x - 7, y + 7);
  overlay_context.stroke();
  overlay_context.closePath();
}

function measureDistance(e) {
  if (has_image == false)
    return;

  click_count = click_count + 1;
  var x = parseInt((e.clientX - overlay_canvas.offsetLeft) * width / canvas_width);
  var y = parseInt((e.clientY - overlay_canvas.offsetTop) * height / canvas_height);
  if (click_count % 2 == 0) {
    drawCross(x, y);
    overlay_context.beginPath();
    overlay_context.moveTo(start_x, start_y);
    overlay_context.lineTo(x, y);
    overlay_context.strokeStyle = 'blue';
    overlay_context.lineWidth = 2;
    overlay_context.stroke();
    overlay_context.closePath();
    statusElement.innerHTML = 'Status Info : Measure: ';
    ep.measureDistance(currentPhoto, {x: start_x, y: start_y}, {x: x, y: y}).then(
        function(d) {
          statusElement.innerHTML += 'distance = ' +
              parseFloat(d.distance).toFixed(2) + ' millimeters';
          overlay_context.fillStyle = 'blue';
          overlay_context.font = 'bold 14px Arial';
          overlay_context.fillText(
              parseFloat(d.distance).toFixed(2) + ' mm',
              (start_x + x) / 2, (start_y + y) / 2 - 5);
        },
        function(e) { statusElement.innerHTML += e; });
  } else {
    overlay_context.clearRect(0, 0, width, height);
    drawCross(x, y);
    start_x = x;
    start_y = y;
  }
}

function depthRefocus(e) {
  if (has_image == false)
    return;

  var x = parseInt((e.clientX - overlay_canvas.offsetLeft) * width / canvas_width);
  var y = parseInt((e.clientY - overlay_canvas.offsetTop) * height / canvas_height);

  overlay_context.clearRect(0, 0, width, height);
  drawCross(x, y);

  ep.depthRefocus(currentPhoto, { x: x, y: y }, 50.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryReferenceImage().then(
            function(image) {
              image_data = image_context.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Depth refocus success. Please select focus point again.';
              overlay_context.clearRect(0, 0, width, height);
              image_data.data.set(image.data);
              image_context.putImageData(image_data, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthEnhance() {
  ep.enhanceDepth(currentPhoto, 'low').then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepthImage().then(
            function(image) {
              image_context.clearRect(0, 0, width, height);
              image_data = image_context.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Finished depth enhancing.';
              ConvertDepthToRGBUsingHistogram(
                  image, [255, 255, 255], [0, 0, 0], image_data.data);
              image_context.putImageData(image_data, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthUpscale() {
  ep.depthResize(currentPhoto, { width: width, height: height }).then(
      function(photo) {
        savePhoto = photo;
        photo.queryDepthImage().then(
            function(image) {
              image_data = image_context.createImageData(image.width, image.height);
              statusElement.innerHTML = 'Finished depth upscaling.';
              ConvertDepthToRGBUsingHistogram(
                  image, [255, 255, 255], [0, 0, 0], image_data.data);
              image_context.putImageData(image_data, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function pasteOnPlane(e) {
  if (has_image == false)
    return;

  click_count = click_count + 1;
  var x = parseInt((e.clientX - overlay_canvas.offsetLeft) * width / canvas_width);
  var y = parseInt((e.clientY - overlay_canvas.offsetTop) * height / canvas_height);
  if (click_count % 2 == 0) {
    drawCross(x, y);
    overlay_context.beginPath();
    overlay_context.moveTo(start_x, start_y);
    overlay_context.lineTo(x, y);
    overlay_context.strokeStyle = 'blue';
    overlay_context.lineWidth = 2;
    overlay_context.stroke();
    overlay_context.closePath();

    var sticker_data = [];
    var len = 30 * 30 * 4;
    for (var i = 0; i < len; i += 4) {
      sticker_data[i] = 150;
      sticker_data[i + 1] = 100;
      sticker_data[i + 2] = 100;
      sticker_data[i + 3] = 255;
    }
    var sticker = {
      width: 30,
      height: 30,
      data: sticker_data
    };

    ep.pasteOnPlane(currentPhoto, sticker, { x: start_x, y: start_y }, { x: x, y: y }).then(
        function(photo) {
          savePhoto = photo;
          photo.queryReferenceImage().then(
              function(image) {
                statusElement.innerHTML = 'Finished paste on plane.';
                image_data.data.set(image.data);
                image_context.putImageData(image_data, 0, 0);
              },
              function(e) { statusElement.innerHTML = e; });
        },
        function(e) { statusElement.innerHTML = e; });
  } else {
    overlay_context.clearRect(0, 0, width, height);
    drawCross(x, y);
    start_x = x;
    start_y = y;
  }
}

function main() {
  ep = realsense.EnhancedPhotography;

  preview_context = preview_canvas.getContext('2d');
  image_context = image_canvas.getContext('2d');
  overlay_context = overlay.getContext('2d');

  measureRadio.addEventListener('click', function(e) {
    if (measureRadio.checked) {
      if (has_image == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML = 'Select two points to measure distance.';
      overlay_context.clearRect(0, 0, width, height);
      currentPhoto.queryReferenceImage().then(
          function(image) {
            image_context.clearRect(0, 0, width, height);
            image_data = image_context.createImageData(image.width, image.height);
            image_data.data.set(image.data);
            image_context.putImageData(image_data, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  refocusRadio.addEventListener('click', function(e) {
    if (refocusRadio.checked) {
      if (has_image == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML = 'Select the refocus point.';
      overlay_context.clearRect(0, 0, width, height);
      currentPhoto.queryReferenceImage().then(
          function(image) {
            image_context.clearRect(0, 0, width, height);
            image_data = image_context.createImageData(image.width, image.height);
            image_data.data.set(image.data);
            image_context.putImageData(image_data, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  depthEnhanceRadio.addEventListener('click', function(e) {
    if (depthEnhanceRadio.checked) {
      if (has_image == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlay_context.clearRect(0, 0, width, height);
      depthEnhance();
    }
  }, false);

  depthUpscaleRadio.addEventListener('click', function(e) {
    if (depthUpscaleRadio.checked) {
      if (has_image == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      overlay_context.clearRect(0, 0, width, height);
      depthUpscale();
    }
  }, false);

  pasteOnPlaneRadio.addEventListener('click', function(e) {
    if (pasteOnPlaneRadio.checked) {
      if (has_image == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }

      statusElement.innerHTML =
          'Select TOP LEFT and BOTTOM LEFT corners to paste sticker on plane.';
      overlay_context.clearRect(0, 0, width, height);
      currentPhoto.queryReferenceImage().then(
          function(image) {
            image_context.clearRect(0, 0, width, height);
            image_data.data.set(image.data);
            image_context.putImageData(image_data, 0, 0);
          },
          function(e) { statusElement.innerHTML = e; });
    }
  }, false);

  overlay_canvas.addEventListener('mousedown', function(e) {
    if (measureRadio.checked) {
      measureDistance(e);
    }
    if (refocusRadio.checked) {
      depthRefocus(e);
    }
    if (pasteOnPlaneRadio.checked) {
      pasteOnPlane(e);
    }
  }, false);

  preview_data = preview_context.createImageData(width, height);

  var image_fps = new Stats();
  image_fps.domElement.style.position = 'absolute';
  image_fps.domElement.style.top = '0px';
  image_fps.domElement.style.right = '0px';
  document.getElementById('canvas_container').appendChild(image_fps.domElement);

  var getting_image = false;

  ep.onpreview = function(e) {
    if (getting_image)
      return;
    getting_image = true;
    ep.getPreviewImage().then(
        function(image) {
          preview_data.data.set(image.data);
          preview_context.putImageData(preview_data, 0, 0);
          image_fps.update();
          getting_image = false;
        }, function() {});
  };

  ep.onerror = function(e) {
    statusElement.innerHTML = 'Status Info : onerror: ' + e.status;
  };

  startButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Start: ';
    getting_image = false;
    ep.startPreview().then(function(e) { statusElement.innerHTML += e; },
                           function(e) { statusElement.innerHTML += e; });
  };

  snapShotButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : TakeSnapshot: ';
    ep.takeSnapShot().then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                image_data = image_context.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                overlay_context.clearRect(0, 0, width, height);
                image_data.data.set(image.data);
                image_context.putImageData(image_data, 0, 0);
                has_image = true;
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
    // TODO(qjia7): Allow user to config the file path.
    statusElement.innerHTML = 'Status Info : Save as C:/workspace/photo2.jpg ';
    ep.saveAsXMP(savePhoto, 'C:/workspace/photo2.jpg').then(
        function(e) { statusElement.innerHTML += e; },
        function(e) { statusElement.innerHTML += e; });
  };

  loadButton.onclick = function(e) {
    // TODO(qjia7): Allow user to config the file path.
    statusElement.innerHTML =
        'Status Info : Load from C:/workspace/photo1.jpg : ';
    ep.loadFromXMP('C:/workspace/photo1.jpg').then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                image_context.clearRect(0, 0, width, height);
                image_data = image_context.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                overlay_context.clearRect(0, 0, width, height);
                image_data.data.set(image.data);
                image_context.putImageData(image_data, 0, 0);
                has_image = true;
                if (depthEnhanceRadio.checked) {
                  depthEnhance();
                }
                if (depthUpscaleRadio.checked) {
                  depthUpscale();
                }
              },
              function(e) { statusElement.innerHTML += e; });},
        function(e) { statusElement.innerHTML += e; });
  };

  stopButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Stop: ';
    ep.stopPreview().then(function(e) { statusElement.innerHTML += e; },
                          function(e) { statusElement.innerHTML += e; });
  };
}
