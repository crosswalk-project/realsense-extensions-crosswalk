var resolutionSelect = document.getElementById('resolution');
var cameraLabel = document.getElementById('camera');
var depthMapCheckBox = document.getElementById('depthmap');
var viewerDiv = document.getElementById('viewer');
var videoElement = document.getElementById('preview');
var depthCanvas = document.getElementById('depth');
var depthContext = depthCanvas.getContext('2d');
var overlayCanvas = document.getElementById('overlay');
var overlayContext = overlay.getContext('2d');
depthCanvas.style.display = 'none';
resolutionSelect.value = 'vga';

var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var getDefaultsButton = document.getElementById('getDefaultsConf');
var setConfButton = document.getElementById('setConf');
var getConfButton = document.getElementById('getConf');
var registerButton = document.getElementById('registerFace');
var unregisterButton = document.getElementById('unregisterFace');

var trackingColorModeRadio = document.getElementById('tracking_color');
var trackingColorDepthModeRadio = document.getElementById('tracking_color_depth');

var strategyTimeRadio = document.getElementById('strategy_time');
var strategyCloseFarRadio = document.getElementById('strategy_close_far');
var strategyFarCloseRadio = document.getElementById('strategy_far_close');
var strategyLeftRightRadio = document.getElementById('strategy_left_right');
var strategyRightLeftRadio = document.getElementById('strategy_right_left');

var detectionCheckbox = document.getElementById('enableDetection');
var detectionMaxFacesNum = document.getElementById('detection_max_faces');

var landmarksCheckbox = document.getElementById('enableLandmarks');
var landmarksMaxFacesNum = document.getElementById('landmarks_max_faces');
var landmarksMaxLandmarksNum = document.getElementById('landmarks_max_landmarks');

var recognitionCheckbox = document.getElementById('enableRecognition');

var resolutionTextElement = document.getElementById('resolutionText');
var statusElement = document.getElementById('status');
var recognitionDataElement = document.getElementById('recognitionData');

var processedSampleFps = new Stats();
processedSampleFps.domElement.style.position = 'absolute';
processedSampleFps.domElement.style.top = '0px';
processedSampleFps.domElement.style.left = '0px';
document.body.appendChild(processedSampleFps.domElement);

const cameraName = 'Intel(R) RealSense(TM) 3D Camera R200';
var cameraId = '';

var previewStream = null;
var ft = null;
var ftStarted = false;

var constraintsMap = {
  'qvga60': {width: 320, height: 240, fps: 60},
  'vga60': {width: 640, height: 480, fps: 60},
  'vga': {width: 640, height: 480, fps: 30},
  'hd': {width: 1280, height: 720, fps: 30},
  'fhd': {width: 1920, height: 1080, fps: 30},
};

function ConvertDepthToRGBUsingHistogram(
    depthImage, nearColor, farColor, rgbImage, depthWidth, depthHeight) {
  var imageSize = depthWidth * depthHeight;
  for (var l = 0; l < imageSize; ++l) {
    rgbImage[l * 4] = 0;
    rgbImage[l * 4 + 1] = 0;
    rgbImage[l * 4 + 2] = 0;
    rgbImage[l * 4 + 3] = 255;
  }
  // Produce a cumulative histogram of depth values
  var histogram = new Int32Array(256 * 256);
  var imageSize = depthWidth * depthHeight;
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

// Collect user settings
function getConf() {
  var faceModuleConf = {};

  // Tracking mode
  if (trackingColorModeRadio.checked) {
    faceModuleConf.mode = 'color';
  } else if (trackingColorDepthModeRadio.checked) {
    faceModuleConf.mode = 'color_depth';
  }
  // Tracking strategy
  if (strategyTimeRadio.checked) {
    faceModuleConf.strategy = 'appearance_time';
  } else if (strategyCloseFarRadio.checked) {
    faceModuleConf.strategy = 'closest_farthest';
  } else if (strategyFarCloseRadio.checked) {
    faceModuleConf.strategy = 'farthest_closest';
  } else if (strategyLeftRightRadio.checked) {
    faceModuleConf.strategy = 'left_right';
  } else if (strategyRightLeftRadio.checked) {
    faceModuleConf.strategy = 'right_left';
  }
  // detection
  faceModuleConf.detection = {};
  faceModuleConf.detection.enable = detectionCheckbox.checked;
  if (detectionMaxFacesNum.value) {
    faceModuleConf.detection.maxFaces = parseInt(detectionMaxFacesNum.value);
  }

  // landmarks
  faceModuleConf.landmarks = {};
  faceModuleConf.landmarks.enable = landmarksCheckbox.checked;
  if (landmarksMaxFacesNum.value) {
    faceModuleConf.landmarks.maxFaces = parseInt(landmarksMaxFacesNum.value);
  }

  // recognition
  faceModuleConf.recognition = {};
  faceModuleConf.recognition.enable = recognitionCheckbox.checked;

  return faceModuleConf;
}

function setConf(faceModuleConf) {
  // Tracking mode
  if (faceModuleConf.mode == 'color') {
    trackingColorModeRadio.checked = true;
  } else if (faceModuleConf.mode == 'color_depth') {
    trackingColorDepthModeRadio.checked = true;
  }
  // Tracking strategy
  if (faceModuleConf.strategy == 'appearance_time') {
    strategyTimeRadio.checked = true;
  } else if (faceModuleConf.strategy == 'closest_farthest') {
    strategyCloseFarRadio.checked = true;
  } else if (faceModuleConf.strategy == 'farthest_closest') {
    strategyFarCloseRadio.checked = true;
  } else if (faceModuleConf.strategy == 'left_right') {
    strategyLeftRightRadio.checked = true;
  } else if (faceModuleConf.strategy == 'right_left') {
    strategyRightLeftRadio.checked = true;
  }
  // detection
  detectionCheckbox.checked = faceModuleConf.detection.enable;
  detectionMaxFacesNum.value = faceModuleConf.detection.maxFaces;

  // landmarks
  landmarksCheckbox.checked = faceModuleConf.landmarks.enable;
  landmarksMaxFacesNum.value = faceModuleConf.landmarks.maxFaces;
  landmarksMaxLandmarksNum.innerHTML = faceModuleConf.landmarks.numLandmarks.toString();

  // recognition
  recognitionCheckbox.checked = faceModuleConf.recognition.enable;
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
  } else {
    cameraLabel.innerHTML = cameraName + ' is not available';
    cameraLabel.style.color = 'red';
  }
}

function errorCallback(error) {
  statusElement.innerHTML = error;
}

function main() {
  navigator.mediaDevices.enumerateDevices().then(gotDevices, errorCallback);
}

function clearAfterStopped() {
  ftStarted = false;
  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);
  depthMapCheckBox.checked = false;
  depthMapCheckBox.onchange();
  depthMapCheckBox.disabled = true;
  trackingColorModeRadio.disabled = false;
  trackingColorDepthModeRadio.disabled = false;
}

setConfButton.onclick = function(e) {
  if (!ft) return;
  // Call configuration.set API.
  ft.configuration.set(getConf()).then(
      function() {
        statusElement.innerHTML = 'Status: set configuration succeeds';
        console.log('set configuration succeeds');},
      function(e) {
        statusElement.innerHTML = 'Status: ' + e.message;
        console.log(e.message);});
};

getDefaultsButton.onclick = function(e) {
  if (!ft) return;
  // Call configuration.getDefaults API, will get back default FaceConfiguration value.
  ft.configuration.getDefaults().then(
      function(confData) {
        // Show FaceConfiguration values onto UI.
        setConf(confData);
        statusElement.innerHTML = 'Status: get default configuration succeeds';
        console.log('get default configuration succeeds');},
      function(e) {
        statusElement.innerHTML = 'Status: ' + e.message;
        console.log(e.message);});
};

function onGetConfButton(e) {
  if (!ft) return;
  // Call configuration.get API, will get back current FaceConfiguration value.
  ft.configuration.get().then(
      function(confData) {
        // Show FaceConfiguration values onto UI.
        setConf(confData);
        statusElement.innerHTML = 'Status: get current configuration succeeds';
        console.log('get current configuration succeeds');},
      function(e) {
        statusElement.innerHTML = 'Status: ' + e.message;
        console.log(e.message);});
}

getConfButton.onclick = onGetConfButton;

function stopPreviewStream() {
  if (previewStream) {
    previewStream.getTracks().forEach(function(track) {
      track.stop();
    });
    if (ft) {
      // Remove listeners as we don't care about the events.
      ft.onerror = null;
      ft.onprocessedsample = null;
      ft = null;
    }
  }
  previewStream = null;
}

startButton.onclick = function(e) {
  if (ftStarted) return;
  if (cameraId === '') {
    return;
  }

  stopPreviewStream();

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
        try {
          ft = new realsense.Face.FaceModule(stream);
        } catch (e) {
          statusElement.innerHTML = e.message;
          return;
        }

        ft.onprocessedsample = function(e) {
          ft.getProcessedSample(false, depthMapCheckBox.checked).then(function(processedSample) {
            if (overlayCanvas.width != videoElement.clientWidth ||
                overlayCanvas.height != videoElement.clientHeight) {
              overlayCanvas.width = videoElement.clientWidth;
              overlayCanvas.height = videoElement.clientHeight;
              overlayContext = overlayCanvas.getContext('2d');
            }

            overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

            var xScale = overlayCanvas.width / resolution.width;
            var yScale = overlayCanvas.height / resolution.height;

            var recogData = '';
            // Get traced faces.
            for (var i = 0; i < processedSample.faces.length; ++i) {
              var face = processedSample.faces[i];
              // Draw rect on every tracked face.
              if (face.detection) {
                var rect = face.detection.boundingRect;

                overlayContext.strokeStyle = 'red';
                overlayContext.strokeRect(
                    rect.x * xScale, rect.y * yScale, rect.w * xScale, rect.h * yScale);
                // Print face ID
                overlayContext.font = '20px';
                overlayContext.fillStyle = 'white';
                overlayContext.fillText(
                    'Face ID: ' + face.faceId, (rect.x + 5) * xScale, (rect.y + 10) * yScale);
              }
              // Draw landmark points on every tracked face.
              if (face.landmarks) {
                for (var j = 0; j < face.landmarks.points.length; ++j) {
                  var landmark_point = face.landmarks.points[j];
                  overlayContext.font = '6px';
                  if (landmark_point.confidenceImage) {
                    // White color for confidence point.
                    overlayContext.fillStyle = 'white';
                    overlayContext.fillText('*',
                        (landmark_point.coordinateImage.x - 3) * xScale,
                        (landmark_point.coordinateImage.y + 3) * yScale);
                  } else {
                    // Red color for non-confidence point.
                    overlayContext.fillStyle = 'red';
                    overlayContext.fillText('x',
                        (landmark_point.coordinateImage.x - 3) * xScale,
                        (landmark_point.coordinateImage.y + 3) * yScale);
                  }
                }
              }
              // Print recognition id for every tracked face.
              if (face.recognition) {
                var recognitionId = face.recognition.userId;
                var text;
                if (recognitionId == -1) {
                  text = 'Not Registered';
                } else {
                  text = 'Recog ID: ' + recognitionId;
                }
                if (face.detection) {
                  var rect = face.detection.boundingRect;
                  overlayContext.font = '20px';
                  overlayContext.fillStyle = 'white';
                  overlayContext.fillText(text, rect.x * xScale, (rect.y + rect.h - 5) * yScale);
                }
                recogData = recogData + '(' + face.faceId + ', ' + recognitionId + ') ';
              }
            }

            recognitionDataElement.innerHTML = '(Face id: Recognition id) : ' + recogData;

            if (!depthMapCheckBox.checked) {
              resolutionTextElement.innerHTML = '';
            } else if (processedSample.depth) {
              resolutionTextElement.innerHTML =
                  'Depth Map (' + processedSample.depth.width + 'x' +
                  processedSample.depth.height + ')';
              if (depthCanvas.width != processedSample.depth.width ||
                  depthCanvas.height != processedSample.depth.height) {
                depthCanvas.width = processedSample.depth.width;
                depthCanvas.height = processedSample.depth.height;
                depthContext = depthCanvas.getContext('2d');
              }
              depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);

              var depth_image_data = depthContext.createImageData(
                  processedSample.depth.width, processedSample.depth.height);

              ConvertDepthToRGBUsingHistogram(
                  processedSample.depth.data, [255, 0, 0], [20, 40, 255], depth_image_data.data,
                  processedSample.depth.width, processedSample.depth.height);
              depthContext.putImageData(depth_image_data, 0, 0);
            } else {
              resolutionTextElement.innerHTML = 'No Depth Map';
            }

            processedSampleFps.update();
          }, function(e) {
            statusElement.innerHTML = 'Status: ' + e.message; console.log(e.message);});
        };

        ft.onerror = function(e) {
          statusElement.innerHTML = 'Status: onerror: ' + e.message;
        };

        ft.onready = function(e) {
          console.log('Face module ready to start');
          ft.ready = true;
          ft.start().then(
              function() {
                ftStarted = true;
                statusElement.innerHTML = 'Status: start succeeds';
                console.log('start succeeds');
                depthMapCheckBox.disabled = false;
                trackingColorModeRadio.disabled = true;
                trackingColorDepthModeRadio.disabled = true;
                onGetConfButton();},
              function(e) {
                statusElement.innerHTML = 'Status: ' + e.message;
                console.log(e.message);});
        };

        ft.onended = function(e) {
          console.log('Face module ends without stop');
          ftStarted = false;
        };

        ft.ready = false;
        ftStarted = false;
      }, errorCallback);
};

stopButton.onclick = function(e) {
  if (!ft) return;
  ft.stop().then(
      function() {
        statusElement.innerHTML = 'Status: stop succeeds';
        console.log('stop succeeds');
        clearAfterStopped();
        stopPreviewStream();},
      function(e) {
        statusElement.innerHTML = 'Status: stop fails';
        console.log('stop fails');
        clearAfterStopped();
        stopPreviewStream();});
};

registerButton.onclick = function(e) {
  if (!ft) return;
  var faceId = parseInt(document.getElementById('recognition_face_id').value);
  // Call recognition.registerUserByFaceID API
  ft.recognition.registerUserByFaceID(faceId).then(
      function(recogId) {
        statusElement.innerHTML =
            'Status: register face succeeds faceId: ' + faceId + ', recogId: ' + recogId;
        console.log('register face succeeds');},
      function(e) {
        statusElement.innerHTML = 'Status: ' + e.message;
        console.log(e.message);});
};

unregisterButton.onclick = function(e) {
  if (!ft) return;
  var recogId = parseInt(document.getElementById('recognition_recog_id').value);
  // Call recognition.unregisterUserByID API
  ft.recognition.unregisterUserByID(recogId).then(
      function() {
        statusElement.innerHTML = 'Status: unregister user succeeds recogId: ' + recogId;
        console.log('unregister user succeeds');},
      function(e) {
        statusElement.innerHTML = 'Status: ' + e.message;
        console.log(e.message);});
};

depthMapCheckBox.onchange = function(e) {
  if (depthMapCheckBox.checked) {
    videoElement.style.display = 'none';
    overlayCanvas.style.display = 'none';
    depthCanvas.style.display = 'inline';
  } else {
    videoElement.style.display = 'inline';
    overlayCanvas.style.display = 'inline';
    depthCanvas.style.display = 'none';
  }
};

depthMapCheckBox.disabled = true;
