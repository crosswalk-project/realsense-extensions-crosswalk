var videoElement = document.getElementById('preview');
var depthCanvas = document.getElementById('depth');
depthCanvas.style.display = 'none';
var depthContext = depthCanvas.getContext('2d');
var cameraLabel = document.getElementById('camera');
var resolutionSelect = document.getElementById('resolution');
var takePhotoButton = document.getElementById('takephoto');
var statusElement = document.getElementById('status');
var qualityElement = document.getElementById('quality');
resolutionSelect.value = 'fhd';
var depthMapCheckBox = document.getElementById('depthmap');
var viewerDiv = document.getElementById('viewer');
var depthResolution = document.getElementById('depthResolution');

var eventsFPS = new Stats();
eventsFPS.domElement.style.position = 'absolute';
eventsFPS.domElement.style.top = '0px';
eventsFPS.domElement.style.left = '0px';
document.body.appendChild(eventsFPS.domElement);

const cameraName = 'Intel(R) RealSense(TM) 3D Camera R200';
var cameraId = '';

var previewStream = null;
var photoCapture = null;
var depthPhoto = null;

var constraintsMap = {
  'qvga': {width: 320, height: 240, fps: 60},
  'vga': {width: 640, height: 480, fps: 60},
  'hd': {width: 1280, height: 720, fps: 30},
  'fhd': {width: 1920, height: 1080, fps: 30},
};

var qualityMap = {
  'good': {text: 'GOOD', color: 'green'},
  'fair': {text: 'FAIR', color: 'orange'},
  'bad' : {text: 'BAD ', color: 'red'}
};

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

function gotDevices(deviceInfos) {
  for (var i = 0; i < deviceInfos.length; ++i) {
    var deviceInfo = deviceInfos[i];
    if (deviceInfo.kind === 'videoinput') {
      console.log(deviceInfo.label);
      if (deviceInfo.label === cameraName) {
        cameraId = deviceInfo.deviceId;
        break;
      }
    }
  }
  if (cameraId !== '') {
    cameraLabel.innerHTML = cameraName;
    preview();
  } else {
    cameraLabel.innerHTML = cameraName + ' is not available';
    cameraLabel.style.color = 'red';
  }
}

function main() {
  navigator.mediaDevices.enumerateDevices().then(gotDevices, errorCallback);
}

function preview() {
  if (cameraId === '') {
    return;
  }
  if (previewStream) {
    previewStream.getTracks().forEach(function(track) {
      track.stop();
    });
  }
  var resolution = constraintsMap[resolutionSelect.value];
  var constraints = {video: {
    width: {exact: resolution.width},
    height: {exact: resolution.height},
    frameRate: {exact: resolution.fps}}};
  constraints.video.deviceId = {exact: cameraId};
  navigator.mediaDevices.getUserMedia(constraints)
      .then(function(stream) {
        previewStream = stream;
        videoElement.srcObject = stream;
        photoCapture = new realsense.DepthEnabledPhotography.PhotoCapture(stream);
        photoCapture.onerror = function(e) {
          statusElement.innerHTML = e.data.error;
        };
        photoCapture.ondepthquality = function(e) {
          eventsFPS.update();
          var quality = e.data.quality;
          qualityElement.innerHTML = qualityMap[quality].text;
          qualityElement.style.color = qualityMap[quality].color;
          if (depthMapCheckBox.checked) {
            photoCapture.getDepthImage().then(
                function(image) {
                  depthResolution.innerHTML = '(' + image.width + 'x' + image.height + ')';
                  if (image.width != depthCanvas.width || image.height != depthCanvas.height) {
                    depthCanvas.width = image.width;
                    depthCanvas.height = image.height;
                    depthContext = depthCanvas.getContext('2d');
                  }
                  depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);
                  var imageData = depthContext.createImageData(image.width, image.height);
                  ConvertDepthToRGBUsingHistogram(
                      image, [255, 255, 255], [0, 0, 0], imageData.data);
                  depthContext.putImageData(imageData, 0, 0);
                },
                function(e) { statusElement.innerHTML = e; });
          } else {
            depthResolution.innerHTML = '';
          }
        };
      }, errorCallback);
}

function errorCallback(error) {
  statusElement.innerHTML = error;
}

resolutionSelect.onchange = preview;

takePhotoButton.onclick = function(e) {
  if (photoCapture) {
    statusElement.innerHTML = 'Taking depth photo...';
    photoCapture.takePhoto().then(function(photo) {
      statusElement.innerHTML = 'Saving depth photo...';
      realsense.DepthEnabledPhotography.XDMUtils.saveXDM(photo).then(
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
          function(e) { statusElement.innerHTML = e; });
    },
    function(e) { statusElement.innerHTML = e; });
  }
};

depthMapCheckBox.onchange = function(e) {
  if (depthMapCheckBox.checked) {
    videoElement.style.display = 'none';
    depthCanvas.style.display = 'inline';
  } else {
    videoElement.style.display = 'inline';
    depthCanvas.style.display = 'none';
  }
};
