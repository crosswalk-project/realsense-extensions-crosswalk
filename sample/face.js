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

var colorImageSizeElement = document.getElementById('2DSize');
var depthImageSizeElement = document.getElementById('3DSize');
var statusElement = document.getElementById('status');
var recognitionDataElement = document.getElementById('recognitionData');

var color_canvas = document.getElementById('color');
var color_context = color_canvas.getContext('2d');
var color_image_data;

var depth_canvas = document.getElementById('depth');
var depth_context = depth_canvas.getContext('2d');
var depth_image_data;

var ft;

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

function main() {
  ft = new realsense.Face.FaceModule();

  var processed_sample_fps = new Stats();
  processed_sample_fps.domElement.style.position = 'absolute';
  processed_sample_fps.domElement.style.top = '0px';
  processed_sample_fps.domElement.style.right = '0px';
  document.getElementById('color_container').appendChild(processed_sample_fps.domElement);

  var currentFaceDataArray = [];

  var getting_processed_sample = false;
  ft.onprocessedsample = function(e) {
    if (getting_processed_sample)
      return;
    getting_processed_sample = true;
    ft.getProcessedSample().then(function(processed_sample) {
      colorImageSizeElement.innerHTML =
          '2D(' + processed_sample.color.width + ', ' +
          processed_sample.color.height + ')';

      // In case color stream size changed
      if (color_canvas.width != processed_sample.color.width ||
          color_canvas.height != processed_sample.color.height) {
        // Resize canvas
        color_canvas.width = processed_sample.color.width;
        color_canvas.height = processed_sample.color.height;
        // Create new image data object
        color_context = color_canvas.getContext('2d');
        color_image_data = color_context.createImageData(
            processed_sample.color.width, processed_sample.color.height);
      }

      if (!color_image_data) {
        color_image_data = color_context.createImageData(
            processed_sample.color.width, processed_sample.color.height);
      }
      color_image_data.data.set(processed_sample.color.data);
      color_context.putImageData(color_image_data, 0, 0);

      var recogData = '';
      // Get traced faces.
      for (var i = 0; i < processed_sample.faces.length; ++i) {
        var face = processed_sample.faces[i];
        // Draw rect on every tracked face.
        if (face.detection) {
          var rect = face.detection.boundingRect;
          //statusElement.innerHTML = 'Status: face rect is ('
          //    + rect.x + ' ' + rect.y + ' ' + rect.w + ' ' + rect.h + ')';
          color_context.strokeStyle = 'red';
          color_context.strokeRect(rect.x, rect.y, rect.w, rect.h);
          // Print face ID
          color_context.font = '20px';
          color_context.fillStyle = 'white';
          color_context.fillText(face.faceId, rect.x + 5, rect.y + 10);
          console.log('Face No.' + i + ': boundingRect: ' +
              rect.x + ' ' + rect.y + ' ' + rect.w + ' ' + rect.h +
              ' avgDepth: ' + face.detection.avgDepth);
        }
        // Draw landmark points on every tracked face.
        if (face.landmarks) {
          for (var j = 0; j < face.landmarks.points.length; ++j) {
            var landmark_point = face.landmarks.points[j];
            color_context.font = '6px';
            if (landmark_point.confidenceImage) {
              // White color for confidence point.
              color_context.fillStyle = 'white';
              color_context.fillText('*',
                  landmark_point.coordinateImage.x - 3, landmark_point.coordinateImage.y + 3);
            } else {
              // Red color for non-confidence point.
              color_context.fillStyle = 'red';
              color_context.fillText('x',
                  landmark_point.coordinateImage.x - 3, landmark_point.coordinateImage.y + 3);
            }
          }
        }
        // Print recognition id for every tracked face.
        if (face.recognition) {
          var recognitionId = face.recognition.userId;
          console.log('Face ID: ' + face.faceId + ': Recognition ID is ' + recognitionId);
          var text;
          if (recognitionId == -1) {
            text = 'Not Registered';
          } else {
            text = 'Recognition ID: ' + recognitionId;
          }
          if (face.detection) {
            var rect = face.detection.boundingRect;
            color_context.font = '20px';
            color_context.fillStyle = 'white';
            color_context.fillText(text, rect.x + 20, rect.y + 10);
          }
          recogData = recogData + '(' + face.faceId + ', ' + recognitionId + ') ';
        }
      }

      recognitionDataElement.innerHTML = '(Face id: Recognition id) : ' + recogData;
      currentFaceDataArray = processed_sample.faces;

      if (processed_sample.depth) {
        depthImageSizeElement.innerHTML =
            '3D(' + processed_sample.depth.width + ', ' +
            processed_sample.depth.height + ')';
        depth_canvas.width = processed_sample.depth.width;
        depth_canvas.height = processed_sample.depth.height;

        if (!depth_image_data) {
          depth_image_data = depth_context.createImageData(
              processed_sample.depth.width, processed_sample.depth.height);
        }

        ConvertDepthToRGBUsingHistogram(
            processed_sample.depth.data, [255, 0, 0], [20, 40, 255], depth_image_data.data,
            processed_sample.depth.width, processed_sample.depth.height);
        depth_context.putImageData(depth_image_data, 0, 0);
      } else {
        depthImageSizeElement.innerHTML = '3D(no stream)';
        console.log('No depth stream available');
      }

      processed_sample_fps.update();
      getting_processed_sample = false;
    }, function(e) {
      getting_processed_sample = false;
      statusElement.innerHTML = 'Status: ' + e; console.log(e);});
  };

  ft.onerror = function(e) {
    statusElement.innerHTML = 'Status: onerror: ' + e.data.status;
  };

  setConfButton.onclick = function(e) {
    // Call configuration.set API.
    ft.configuration.set(getConf()).then(
        function(e) {
          statusElement.innerHTML = 'Status: set configuration succeeds';
          console.log('set configuration succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  getDefaultsButton.onclick = function(e) {
    // Call configuration.getDefaults API, will get back default FaceConfiguration value.
    ft.configuration.getDefaults().then(
        function(confData) {
          // Show FaceConfiguration values onto UI.
          setConf(confData);
          statusElement.innerHTML = 'Status: get default configuration succeeds';
          console.log('get default configuration succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  getConfButton.onclick = function(e) {
    // Call configuration.get API, will get back current FaceConfiguration value.
    ft.configuration.get().then(
        function(confData) {
          // Show FaceConfiguration values onto UI.
          setConf(confData);
          statusElement.innerHTML = 'Status: get current configuration succeeds';
          console.log('get current configuration succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  startButton.onclick = function(e) {
    getting_processed_sample = false;
    ft.start().then(
        function(e) {
          statusElement.innerHTML = 'Status: start succeeds';
          console.log('start succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  stopButton.onclick = function(e) {
    ft.stop().then(
        function(e) {
          statusElement.innerHTML = 'Status: stop succeeds';
          console.log('stop succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  registerButton.onclick = function(e) {
    var faceId = parseInt(document.getElementById('recognition_face_id').value);
    // Call recognition.registerUserByFaceID API
    ft.recognition.registerUserByFaceID(faceId).then(
        function(e) {
          statusElement.innerHTML = 'Status: register face succeeds faceId: ' + faceId;
          console.log('register face succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

  unregisterButton.onclick = function(e) {
    var recogId = parseInt(document.getElementById('recognition_recog_id').value);
    // Call recognition.unregisterUserByID API
    ft.recognition.unregisterUserByID(recogId).then(
        function(e) {
          statusElement.innerHTML = 'Status: unregister user succeeds recogId: ' + recogId;
          console.log('unregister user succeeds');},
        function(e) {
          statusElement.innerHTML = 'Status: ' + e;
          console.log(e);});
  };

}
