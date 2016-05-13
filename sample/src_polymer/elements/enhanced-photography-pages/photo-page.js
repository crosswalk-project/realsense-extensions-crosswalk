var photoPageReady = (function() {
  // DOM elements
  var pageDom = null,
      toast = null,
      imageCanvas;

  // RealSense objects.
  var photoUtils, XDMUtils;
  var currentPhoto;

  var hasImage = false;

  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  function errorCallback(error) {
    toastMessage(error.message);
  }

  function ConvertDepthToRGBUsingHistogram(depthImage, nearColor, farColor, rgbImage) {
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
  function fillCanvasUsingColorImage(image) {
    var imageContext = imageCanvas.getContext('2d');

    var imageData = imageContext.createImageData(image.width, image.height);
    imageData.data.set(image.data);

    imageCanvas.width = image.width;
    imageCanvas.height = image.height;
    imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    imageContext.putImageData(imageData, 0, 0);
  }

  function fillCanvasUsingDepthImage(image) {
    var imageContext = imageCanvas.getContext('2d');

    imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
    var imageData = imageContext.createImageData(image.width, image.height);
    ConvertDepthToRGBUsingHistogram(
        image, [255, 255, 255], [0, 0, 0], imageData.data);
    imageContext.putImageData(imageData, 0, 0);
  }

  function getImage() {
    currentPhoto.queryImage().then(
        function(image) {
          fillCanvasUsingColorImage(image);
          toastMessage('queryImage success.');
        }, errorCallback);
  }

  function getContainerImage() {
    currentPhoto.queryContainerImage().then(
        function(image) {
          fillCanvasUsingColorImage(image);
          toastMessage('queryContainerImage success.');
        }, errorCallback);
  }

  function getDepth() {
    currentPhoto.queryDepth().then(
        function(image) {
          fillCanvasUsingDepthImage(image);
          toastMessage('queryDepth success.');
        }, errorCallback);
  }

  function getRawDepth() {
    currentPhoto.queryRawDepth().then(
        function(image) {
          fillCanvasUsingDepthImage(image);
          toastMessage('queryRawDepth success.');
        }, errorCallback);
  }

  function resetContainerImage() {
    currentPhoto.resetContainerImage().then(
        function() {
          toastMessage('resetContainerImage success.');
        }, errorCallback);
  }

  function initPage(dom) {
    pageDom = dom;
    toast = pageDom.$.toast;
    var loadPhoto = pageDom.$.loadPhoto.inputElement;

    photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;
    XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

    imageCanvas = pageDom.$.image;

    // load file click handler
    pageDom._onLoadChanged = function(e) {
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
                          fillCanvasUsingColorImage(image);
                          toastMessage('Load successfully.');
                          hasImage = true;
                          photoUtils.getDepthQuality(currentPhoto).then(
                              function(quality) {
                                toastMessage(' The photo quality is ' + quality);
                              }, errorCallback);
                        }, errorCallback);

                    // Get XDM version.
                    currentPhoto.queryXDMRevision().then(
                        function(xdmVersion) {
                          pageDom.xdmRevision = xdmVersion;
                        }, errorCallback);

                    // Get signature.
                    currentPhoto.checkSignature().then(
                        function(signature) {
                          pageDom.signature = signature;
                        }, errorCallback);

                    // Get number of cameras.
                    currentPhoto.queryNumberOfCameras().then(
                        function(number) {
                          pageDom.cameras = number;
                        }, errorCallback);

                    // Get device vendor info.
                    currentPhoto.queryDeviceVendorInfo().then(
                        function(vendorInfo) {
                          pageDom.deviceVendorInfoModel = vendorInfo.model;
                          pageDom.deviceVendorInfoManufacturer = vendorInfo.manufacturer;
                          pageDom.deviceVendorInfoNotes = vendorInfo.notes;
                        }, errorCallback);

                    // Get camera vendor info.
                    currentPhoto.queryCameraVendorInfo(0).then(
                        function(vendorInfo) {
                          pageDom.cameraVendorInfoModel = vendorInfo.model;
                          pageDom.cameraVendorInfoManufacturer = vendorInfo.manufacturer;
                          pageDom.cameraVendorInfoNotes = vendorInfo.notes;
                        }, errorCallback);

                    // Get camera perscpective model.
                    currentPhoto.queryCameraPerspectiveModel(0).then(
                        function(perspectiveModel) {
                          pageDom.perspectiveModelModel = perspectiveModel.model;
                          pageDom.perspectiveModelFocalLength =
                              '(' + perspectiveModel.focalLength.x + '), ' +
                              '(' + perspectiveModel.focalLength.y + ')';
                          pageDom.perspectiveModelPrincipalPoint =
                              '(' + perspectiveModel.principalPoint.x + '), ' +
                              '(' + perspectiveModel.principalPoint.y + ')';
                          pageDom.perspectiveModelSkew = perspectiveModel.skew;
                          pageDom.perspectiveModelRadialDistortion = '[' +
                              perspectiveModel.radialDistortion.k1 + ', ' +
                              perspectiveModel.radialDistortion.k2 + ', ' +
                              perspectiveModel.radialDistortion.k3 + ']';
                          pageDom.perspectiveModelTangentialDistortion = '[' +
                              perspectiveModel.tangentialDistortion.p1 + ', ' +
                              perspectiveModel.tangentialDistortion.p1 + ']';
                        }, errorCallback);

                    // Get Camera pose.
                    currentPhoto.queryCameraPose(0).then(
                        function(pose) {
                          pageDom.cameraPoses =
                              'transition: (' + pose.transition.x + ', ' +
                                                pose.transition.y + ', ' +
                                                pose.transition.z + '), ' +
                              'rotation: (' + pose.rotation.rotationAngle + ', ' +
                                              pose.rotation.rotationAxisX + ', ' +
                                              pose.rotation.rotationAxisY + ', ' +
                                              pose.rotation.rotationAxisZ + ')';
                        }, errorCallback);

                  }, errorCallback);

            } else {
              toastMessage('This is not a XDM file. Load failed.');
            }
          }, errorCallback);
    };

    function selectButtonInGroup(selectedButton) {
      pageDom.$.queryImageButton.active = false;
      pageDom.$.queryContainerImageButton.active = false;
      pageDom.$.queryDepthButton.active = false;
      pageDom.$.queryRawDepthButton.active = false;
      pageDom.$.resetContainerImageButton.active = false;

      selectedButton.active = true;
    }

    // Connect command handlers.
    pageDom.$.queryImageButton.addEventListener('tap', function() {
      selectButtonInGroup(pageDom.$.queryImageButton);
      if (!hasImage) {
        toastMessage('Please capture/load a photo first.');
        return;
      }
      getImage();
    });

    pageDom.$.queryContainerImageButton.addEventListener('tap', function() {
      selectButtonInGroup(pageDom.$.queryContainerImageButton);
      if (!hasImage) {
        toastMessage('Please capture/load a photo first.');
        return;
      }
      getContainerImage();
    });

    pageDom.$.queryDepthButton.addEventListener('tap', function() {
      selectButtonInGroup(pageDom.$.queryDepthButton);
      if (!hasImage) {
        toastMessage('Please capture/load a photo first.');
        return;
      }
      getDepth();
    });

    pageDom.$.queryRawDepthButton.addEventListener('tap', function() {
      selectButtonInGroup(pageDom.$.queryRawDepthButton);
      if (!hasImage) {
        toastMessage('Please capture/load a photo first.');
        return;
      }
      getRawDepth();
    });

    pageDom.$.resetContainerImageButton.addEventListener('tap', function() {
      selectButtonInGroup(pageDom.$.resetContainerImageButton);
      if (!hasImage) {
        toastMessage('Please capture/load a photo first.');
        return;
      }
      resetContainerImage();
    });
  };

  return function(dom) {
    initPage(dom);
  };
})();
