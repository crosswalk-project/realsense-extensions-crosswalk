var photoPageReady = (function() {
  // DOM elements
  var pageDom = null,
      toast = null,
      imageCanvas;

  // RealSense objects.
  var photoUtils, XDMUtils;
  var currentPhoto;

  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  function errorCallback(error) {
    toastMessage(error.message);
  }

  function fillCanvasUsingColorImage(image) {
    var imageContext = imageCanvas.getContext('2d');

    var imageData = imageContext.createImageData(image.width, image.height);
    imageData.data.set(image.data);

    imageCanvas.width = image.width;
    imageCanvas.height = image.height;
    imageContext.clearRect(0, 0, image.width, image.height);
    imageContext.putImageData(imageData, 0, 0);
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
                            "(" + perspectiveModel.focalLength.x + "), " +
                            "(" + perspectiveModel.focalLength.y + ")" ;
                        pageDom.perspectiveModelPrincipalPoint =
                            "(" + perspectiveModel.principalPoint.x + "), " +
                            "(" + perspectiveModel.principalPoint.y + ")" ;
                        pageDom.perspectiveModelSkew = perspectiveModel.skew;
                        pageDom.perspectiveModelRadialDistortion = "[" +
                            perspectiveModel.radialDistortion.k1 + ", " +
                            perspectiveModel.radialDistortion.k2 + ", " +
                            perspectiveModel.radialDistortion.k3 + "]";
                        pageDom.perspectiveModelTangentialDistortion= "[" +
                            perspectiveModel.tangentialDistortion.p1 + ", " +
                            perspectiveModel.tangentialDistortion.p1 + "]";
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

  };

  return function(dom) {
  	initPage(dom);
  };
})();
