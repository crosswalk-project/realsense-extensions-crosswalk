var photoCapturePageReady = (function() {

  var pageDom = null;

  const cameraName = 'Intel(R) RealSense(TM) 3D Camera R200';
  var cameraId = '';

  var previewStream = null;
  var photoCapture = null;
  var depthPhoto = null;

  function initPage(dom) {
    pageDom = dom;

    pageDom.resolutionKeys = [
      'QVGA 60FPS',
      'VGA 60FPS',
      'VGA 30FPS',
      'HD 30FPS',
      'Full HD 30FPS',
    ];
    pageDom.resolutionValues = [
      {width: 320, height: 240, fps: 60},
      {width: 640, height: 480, fps: 60},
      {width: 640, height: 480, fps: 30},
      {width: 1280, height: 720, fps: 30},
      {width: 1920, height: 1080, fps: 30},
    ];
    // Set default to 'vga fps30'
    pageDom.resolutionIndex = 2;

    pageDom.previewing = false;
    pageDom.showDepth = false;

    var videoElement = pageDom.$.preview;
    var depthCanvas = pageDom.$.depth;
    var depthContext = depthCanvas.getContext('2d');
    var toast = pageDom.$.toast;

    function errorCallback(error) {
      toastMessage(error.message);
    }

    function toastMessage(message) {
      toast.text = message;
      toast.open();
    }

    pageDom._startPhotoCapture = function() {
      if (pageDom.previewing || cameraId === '') {
        return;
      }

      var resolution = pageDom.resolutionValues[pageDom.resolutionIndex];
      var constraints = {video: {
        width: {exact: resolution.width},
        height: {exact: resolution.height},
        frameRate: {exact: resolution.fps}}};
      constraints.video.deviceId = {exact: cameraId};

      navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        previewStream = stream;
        videoElement.srcObject = stream;
        try {
          photoCapture = new realsense.DepthEnabledPhotography.PhotoCapture(stream);
        } catch (e) {
          errorCallback(e);
          return;
        }
        pageDom.previewing = true;
        photoCapture.onerror = errorCallback;
        photoCapture.ondepthquality = function(e) {
          //eventsFPS.update();
          var quality = e.quality;
          //qualityElement.innerHTML = qualityMap[quality].text;
          //qualityElement.style.color = qualityMap[quality].color;
          if (pageDom.showDepth) {
            photoCapture.getDepthImage().then(
                function(image) {
                  toastMessage('image dimension: (' + image.width + 'x' + image.height + ')');
                  if (image.width != depthCanvas.width || image.height != depthCanvas.height) {
                    depthCanvas.width = image.width;
                    depthCanvas.height = image.height;
                    depthContext = depthCanvas.getContext('2d');
                  }
                  depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);
                  var imageData = depthContext.createImageData(image.width, image.height);
                  RSUtils.ConvertDepthToRGBUsingHistogram(
                      image, [255, 255, 255], [0, 0, 0], imageData.data);
                  depthContext.putImageData(imageData, 0, 0);
                }, errorCallback);
          }
        };
      }, errorCallback);
    };

    function clearAfterStopped() {
      pageDom.previewing = false;
      pageDom.showDepth = false;
      depthContext.clearRect(0, 0, depthCanvas.width, depthCanvas.height);
      depthCanvas.style.display = 'none';
      videoElement.style.display = 'inline';
    }

    pageDom._stopPhotoCapture = function() {
      if (previewStream) {
        // Remove listeners as we don't care about the events.
        photoCapture.onerror = null;
        photoCapture.ondepthquality = null;
        previewStream.getTracks().forEach(function(track) {
          track.stop();
        });
        clearAfterStopped();
      }
    };

    pageDom._showDepthCanvas = function() {
      if (pageDom.showDepth) {
        videoElement.style.display = 'none';
        depthCanvas.style.display = 'inline';
      } else {
        videoElement.style.display = 'inline';
        depthCanvas.style.display = 'none';
        pageDom.depthResolutionText = '';
      }
    };

    pageDom._takePhoto = function() {
      if (!photoCapture || !pageDom.previewing) {
        return;
      }
      toastMessage('Taking depth photo...');
      photoCapture.takePhoto().then(function(photo) {
        toastMessage('Saving depth photo...');
        realsense.DepthEnabledPhotography.XDMUtils.saveXDM(photo).then(
            function(blob) {
              xwalk.experimental.native_file_system.requestNativeFileSystem('pictures',
                  function(fs) {
                    var fileName = '/pictures/depthphoto_' + RSUtils.getDateString() + '.jpg';
                    fs.root.getFile(fileName, { create: true }, function(entry) {
                      entry.createWriter(function(writer) {
                        writer.onwriteend = function(e) {
                          toastMessage('The depth photo has been saved to '
                            + fileName + ' successfully.');
                        };
                        writer.onerror = function(e) {
                          toastMessage('Failed to save depth photo.');
                        };
                        writer.write(blob);
                      }, errorCallback);
                    }, errorCallback);
                  }, errorCallback);
            }, errorCallback);
      }, errorCallback);
    };

    // Trigger the user permission prompt by a getUserMedia
    navigator.mediaDevices.getUserMedia({video: true})
        .then(function(stream) {
          stream.getTracks().forEach(function(track) {
            track.stop();
          });
          navigator.mediaDevices.enumerateDevices().then(gotDevices, errorCallback);
        }, errorCallback);
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
      pageDom.hasCamera = true;
    } else {
      console.log('gotDevices: ' + cameraName + ' is not available');
      pageDom.hasCamera = false;
    }
  }

  return function(dom) {
    initPage(dom);
  };
})();
