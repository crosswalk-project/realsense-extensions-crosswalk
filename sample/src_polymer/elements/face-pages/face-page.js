var facepageReady = (function() {

  var facepageDom = null;

  const cameraName = 'Intel(R) RealSense(TM) 3D Camera R200';
  var cameraId = '';

  var previewStream = null;
  var ft = null;
  var processedSampleFps = null;

  function addFpsStats() {
    processedSampleFps = new Stats();
    processedSampleFps.domElement.setAttribute('class', 'center-center');
    facepageDom.$.fpsContainer.appendChild(processedSampleFps.domElement);
  }

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
      console.log('gotDevices: get camera ' + cameraName);
      facepageDom.hasCamera = true;
    } else {
      console.log('gotDevices: ' + cameraName + ' is not available');
      facepageDom.hasCamera = false;
    }
  }

  function stopPreviewStream() {
    if (previewStream) {
      if (ft) {
        // Remove listeners as we don't care about the events.
        ft.onerror = null;
        ft.onprocessedsample = null;
        ft.onready = null;
        ft.onalert = null;
        ft.onended = null;
        ft = null;
        facepageDom.confDisabled = true;
      }
      previewStream.getTracks().forEach(function(track) {
        track.stop();
      });
    }
    previewStream = null;
  }

  function alertFired(msg) {
    console.log('alert: ' + msg);
  }

  function errorCallback(error) {
    console.log('errorCallback: ' + error);
  }

  function activateFacepage() {
    // Trigger the user permission prompt by a getUserMedia
    navigator.mediaDevices.getUserMedia({video: true})
        .then(function(stream) {
          stream.getTracks().forEach(function(track) {
            track.stop();
          });
          navigator.mediaDevices.enumerateDevices().then(gotDevices, errorCallback);
        }, errorCallback);
  }

  function initFacepage(dom) {
    facepageDom = dom;

    addFpsStats();

    facepageDom.resolutionKeys = [
      'QVGA 60FPS',
      'VGA 60FPS',
      'VGA 30FPS',
      'HD 30FPS',
      'Full HD 30FPS',
    ];
    facepageDom.resolutionValues = [
      {width: 320, height: 240, fps: 60},
      {width: 640, height: 480, fps: 60},
      {width: 640, height: 480, fps: 30},
      {width: 1280, height: 720, fps: 30},
      {width: 1920, height: 1080, fps: 30},
    ];
    // Set default to 'vga fps30'
    facepageDom.resolutionIndex = 2;

    facepageDom.ftStarted = false;
    facepageDom.showDepth = false;
    facepageDom.confDisabled = true;
    facepageDom.faceModuleConf = {detection: {}, landmarks: {}, recognition: {}, alert: {}};

    var videoElement = facepageDom.$.preview;
    var depthCanvas = facepageDom.$.depth;
    var depthContext = depthCanvas.getContext('2d');
    var overlayCanvas = facepageDom.$.overlay;
    var overlayContext = overlayCanvas.getContext('2d');
    depthCanvas.style.display = 'none';

    function clearAfterStopped() {
      facepageDom.ftStarted = false;
      facepageDom.showDepth = false;
      overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);
    }

    facepageDom._startFacemodule = function() {
      if (facepageDom.ftStarted) return;
      if (cameraId === '') {
        return;
      }

      stopPreviewStream();

      var resolution = facepageDom.resolutionValues[facepageDom.resolutionIndex];
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
              errorCallback(e.message);
              return;
            }
            facepageDom.confDisabled = false;
            facepageDom._confApply();

            ft.onprocessedsample = function(e) {
              ft.getProcessedSample(false, facepageDom.showDepth).then(function(processedSample) {
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
                      facepageDom.faceIdToReg = face.faceId;
                    } else {
                      text = 'Recog ID: ' + recognitionId;
                      facepageDom.recogIdToUnreg = recognitionId;
                    }
                    if (face.detection) {
                      var rect = face.detection.boundingRect;
                      overlayContext.font = '20px';
                      overlayContext.fillStyle = 'white';
                      overlayContext.fillText(
                          text, rect.x * xScale, (rect.y + rect.h - 5) * yScale);
                    }
                    recogData = recogData + '(' + face.faceId + ', ' + recognitionId + ') ';
                  }
                }

                facepageDom.recogData = recogData;

                if (!facepageDom.showDepth) {
                  facepageDom.depthResolutionText = '';
                } else if (processedSample.depth) {
                  facepageDom.depthResolutionText =
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
                  facepageDom.depthResolutionText = 'No Depth Map';
                }

                processedSampleFps.update();
              }, function(e) {
                errorCallback('Status: ' + e.message); console.log(e.message);});
            };

            ft.onalert = function(e) {
              var text = '';
              if (e.typeLabel == 'new-face-detected') {
                text = 'New face No. ' + e.faceId + ' detected at timestamp ' + e.timeStamp;
              } else if (e.typeLabel == 'face-out-of-fov') {
                text = 'Face No. ' + e.faceId + ' out of view at timestamp ' + e.timeStamp;
              } else if (e.typeLabel == 'face-back-to-fov') {
                text = 'Face No. ' + e.faceId + ' back to view at timestamp ' + e.timeStamp;
              } else if (e.typeLabel == 'face-occluded') {
                text = 'Face No. ' + e.faceId +
                    ' is occluded by some objects at timestamp ' + e.timeStamp;
              } else if (e.typeLabel == 'face-no-longer-occluded') {
                text = 'Face No. ' + e.faceId + ' is no longer occluded at timestamp ' +
                        e.timeStamp;
              } else if (e.typeLabel == 'face-lost') {
                text = 'Face No. ' + e.faceId + ' lost at timestamp ' + e.timeStamp;
              }

              alertFired('Alert: ' + text);
            };

            ft.onerror = function(e) {
              errorCallback('Status: onerror: ' + e.message);
            };

            ft.onready = function(e) {
              console.log('Face module ready to start');
              ft.ready = true;
              ft.start().then(
                  function() {
                    facepageDom.ftStarted = true;
                    errorCallback('Status: start succeeds');
                    console.log('start succeeds');
                    facepageDom._confRevert();
                  },
                  function(e) {
                    facepageDom.ftStarted = false;
                    errorCallback('Status: ' + e.message);
                    console.log(e.message);});
            };

            ft.onended = function(e) {
              console.log('Face module ends without stop');
              facepageDom.ftStarted = false;
            };

            ft.ready = false;
            facepageDom.ftStarted = false;
          }, errorCallback);
    };

    facepageDom._stopFacemodule = function() {
      if (!ft) return;
      ft.stop().then(
          function() {
            errorCallback('Status: stop succeeds');
            console.log('stop succeeds');
            clearAfterStopped();
            stopPreviewStream();},
          function(e) {
            errorCallback('Status: stop fails: ' + e.message);
            console.log('stop fails: ' + e.message);
            clearAfterStopped();
            stopPreviewStream();});
    };

    facepageDom._showDepthCanvas = function() {
      if (facepageDom.showDepth) {
        videoElement.style.display = 'none';
        overlayCanvas.style.display = 'none';
        depthCanvas.style.display = 'inline';
      } else {
        videoElement.style.display = 'inline';
        overlayCanvas.style.display = 'inline';
        depthCanvas.style.display = 'none';
        facepageDom.depthResolutionText = '';
      }
    };

    facepageDom._onConfModeColor = function() {
      facepageDom.faceModuleConf.mode = 'color';
      facepageDom.$$('#colorButton').active = true;
      facepageDom.$$('#colorDepthButton').active = false;
    };

    facepageDom._onConfModeColorDepth = function() {
      facepageDom.faceModuleConf.mode = 'color-depth';
      facepageDom.$$('#colorButton').active = false;
      facepageDom.$$('#colorDepthButton').active = true;
    };

    facepageDom._onstratTimeButton = function() {
      facepageDom.faceModuleConf.strategy = 'appearance-time';
      uncheckAllStrategyButton();
      facepageDom.$$('#stratTimeButton').active = true;
    };

    facepageDom._onstratCloseFarButton = function() {
      facepageDom.faceModuleConf.strategy = 'closest-farthest';
      uncheckAllStrategyButton();
      facepageDom.$$('#stratCloseFarButton').active = true;
    };

    facepageDom._onstratFarCloseButton = function() {
      facepageDom.faceModuleConf.strategy = 'farthest-closest';
      uncheckAllStrategyButton();
      facepageDom.$$('#stratFarCloseButton').active = true;
    };

    facepageDom._onstratLeftRightButton = function() {
      facepageDom.faceModuleConf.strategy = 'left-right';
      uncheckAllStrategyButton();
      facepageDom.$$('#stratLeftRightButton').active = true;
    };

    facepageDom._onstratRightLeftButton = function() {
      facepageDom.faceModuleConf.strategy = 'right-left';
      uncheckAllStrategyButton();
      facepageDom.$$('#stratRightLeftButton').active = true;
    };

    facepageDom._confApply = function() {
      if (!ft) return;
      console.log(JSON.stringify(facepageDom.faceModuleConf, null, 4));
      // Call configuration.set API.
      ft.configuration.set(facepageDom.faceModuleConf).then(
          function() {
            errorCallback('Status: set configuration succeeds');
            console.log('set configuration succeeds');},
          function(e) {
            errorCallback('Status: ' + e.message);
            console.log(e.message);});
    };

    facepageDom._confRevert = function() {
      if (!ft) return;
      // Call configuration.get API, will get back current FaceConfiguration value.
      ft.configuration.get().then(
          function(confData) {
            // Show FaceConfiguration values onto UI.
            facepageDom.faceModuleConf = confData;
            populateConf(confData);
            errorCallback('Status: get current configuration succeeds');
            console.log('get current configuration succeeds');},
          function(e) {
            errorCallback('Status: ' + e.message);
            console.log(e.message);});
    };

    facepageDom._confGetDefault = function() {
      if (!ft) return;
      // Call configuration.getDefaults API, will get back default FaceConfiguration value.
      ft.configuration.getDefaults().then(
          function(confData) {
            // Show FaceConfiguration values onto UI.
            facepageDom.faceModuleConf = confData;
            populateConf(confData);
            errorCallback('Status: get default configuration succeeds');
            console.log('get default configuration succeeds');},
          function(e) {
            errorCallback('Status: ' + e.message);
            console.log(e.message);});
    };

    facepageDom._recogRegister = function() {
      if (!ft) return;
      var faceId = facepageDom.faceIdToReg;
      // Call recognition.registerUserByFaceID API
      ft.recognition.registerUserByFaceID(facepageDom.faceIdToReg).then(
          function(recogId) {
            errorCallback(
                'Status: register face succeeds faceId: ' + faceId + ', recogId: ' + recogId);
            console.log('register face succeeds');},
          function(e) {
            errorCallback('Status: ' + e.message);
            console.log(e.message);});
    };

    facepageDom._recogUnregister = function() {
      if (!ft) return;
      var recogId = facepageDom.recogIdToUnreg;
      // Call recognition.unregisterUserByID API
      ft.recognition.unregisterUserByID(recogId).then(
          function() {
            errorCallback('Status: unregister user succeeds recogId: ' + recogId);
            console.log('unregister user succeeds');},
          function(e) {
            errorCallback('Status: ' + e.message);
            console.log(e.message);});
    };

    function uncheckAllStrategyButton() {
      facepageDom.$$('#stratTimeButton').active = false;
      facepageDom.$$('#stratCloseFarButton').active = false;
      facepageDom.$$('#stratFarCloseButton').active = false;
      facepageDom.$$('#stratLeftRightButton').active = false;
      facepageDom.$$('#stratRightLeftButton').active = false;
    }

    function populateConf(confData) {
      // Tracking mode
      if (confData.mode == 'color') {
        facepageDom._onConfModeColor();
      } else if (confData.mode == 'color-depth') {
        facepageDom._onConfModeColorDepth();
      }
      // Tracking strategy
      if (confData.strategy == 'appearance-time') {
        facepageDom._onstratTimeButton();
      } else if (confData.strategy == 'closest-farthest') {
        facepageDom._onstratCloseFarButton();
      } else if (confData.strategy == 'farthest-closest') {
        facepageDom._onstratFarCloseButton();
      } else if (confData.strategy == 'left-right') {
        facepageDom._onstratLeftRightButton();
      } else if (confData.strategy == 'right-left') {
        facepageDom._onstratRightLeftButton();
      }
    }

    facepageDom._activatedChanged = function(newValue, oldValue) {
      if (newValue) {
        console.log('face page activated');
        activateFacepage();
      } else {
        console.log('face page deactivated');
        clearAfterStopped();
        stopPreviewStream();
      }
    };

  }

  return initFacepage;
})();
