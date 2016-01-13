var loadPhoto = document.getElementById('loadPhoto');
var colorImageRadio = document.getElementById('queryColorImage');
var containerImageRadio = document.getElementById('queryContainerImage');
var depthImageRadio = document.getElementById('queryDepthImage');
var rawDepthImgeRadio = document.getElementById('queryRawDepthImage');
var resetImageRadio = document.getElementById('resetContainerImage');

var statusElement = document.getElementById('status');
var imageCanvas = document.getElementById('image');

var imageContext, imageData;
var currentPhoto;
var width = 1920, height = 1080;

var hasImage = false;
var XDMUtils;

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

function getColorImage() {
  currentPhoto.queryColorImage().then(
      function(image) {
        fillCanvasUsingColorImage(image);
        statusElement.innerHTML = 'queryColorImage success.';
      },
      function(e) { statusElement.innerHTML = e });
}

function getContainerImage() {
  currentPhoto.queryContainerImage().then(
      function(image) {
        fillCanvasUsingColorImage(image);
        statusElement.innerHTML = 'queryContainerImage success.';
      },
      function(e) { statusElement.innerHTML = e });
}

function getDepthImage() {
  currentPhoto.queryDepthImage().then(
      function(image) {
        fillCanvasUsingDepthImage(image);
        statusElement.innerHTML = 'queryDepthImage success.';
      },
      function(e) { statusElement.innerHTML = e });
}

function getRawDepthImage() {
  currentPhoto.queryRawDepthImage().then(
      function(image) {
        fillCanvasUsingDepthImage(image);
        statusElement.innerHTML = 'queryRawDepthImage success.';
      },
      function(e) { statusElement.innerHTML = e });
}

function resetContainerImage() {
  currentPhoto.resetContainerImage().then(
      function() {
        statusElement.innerHTML = 'resetContainerImage success.';
      },
      function(e) { statusElement.innerHTML = e });
}

function main() {
  XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;
  imageContext = imageCanvas.getContext('2d');

  colorImageRadio.addEventListener('click', function(e) {
    if (colorImageRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      getColorImage();
    }
  }, false);

  containerImageRadio.addEventListener('click', function(e) {
    if (containerImageRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      getContainerImage();
    }
  }, false);

  depthImageRadio.addEventListener('click', function(e) {
    if (depthImageRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      getDepthImage();
    }
  }, false);

  rawDepthImgeRadio.addEventListener('click', function(e) {
    if (rawDepthImgeRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      getRawDepthImage();
    }
  }, false);

  resetImageRadio.addEventListener('click', function(e) {
    if (resetImageRadio.checked) {
      if (hasImage == false) {
        statusElement.innerHTML = 'Please capture/load a photo first.';
        return;
      }
      resetContainerImage();
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
                  currentPhoto.queryContainerImage().then(
                      function(image) {
                        fillCanvasUsingColorImage(image);
                        statusElement.innerHTML = 'Load successfully';
                        hasImage = true;
                        if (colorImageRadio.checked) {
                          getColorImage();
                        }
                        if (depthImageRadio.checked) {
                          getDepthImage();
                        }
                        if (rawDepthImgeRadio.checked) {
                          getRawDepthImage();
                        }
                        if (resetImageRadio.checked) {
                          resetContainerImage();
                        }
                      },
                      function(e) { statusElement.innerHTML = e; });

                  currentPhoto.checkSignature().then(
                      function(signature) {
                        var checkSignature = document.getElementById('signature');
                        checkSignature.innerHTML = signature;
                      },
                      function() { });
                  currentPhoto.queryNumberOfCameras().then(
                      function(number) {
                        var camerasNumber = document.getElementById('numberOfCameras');
                        camerasNumber.innerHTML = number;
                      },
                      function() { });
                  currentPhoto.queryDeviceVendorInfo().then(
                      function(venterInfo) {
                        var deviceVendorInfo = document.getElementById('deviceVendorInfo');
                        deviceVendorInfo.innerHTML =
                            'model: ' + venterInfo.model + '<br>' +
                            'manufacturer: ' + venterInfo.manufacturer + '<br>' +
                            'notes: ' + venterInfo.notes;
                      },
                      function() { });
                  currentPhoto.queryCameraVendorInfo(0).then(
                      function(venterInfo) {
                        var cameraVendorInfo = document.getElementById('cameraVendorInfo');
                        cameraVendorInfo.innerHTML =
                            'model: ' + venterInfo.model + '<br>' +
                            'manufacturer: ' + venterInfo.manufacturer + '<br>' +
                            'notes: ' + venterInfo.notes;
                      },
                      function() { });
                  currentPhoto.queryXDMRevision().then(
                      function(xdmVersion) {
                        var curXDMVersion = document.getElementById('XDMRevision');
                        curXDMVersion.innerHTML = xdmVersion;
                      },
                      function() { });
                  currentPhoto.queryCameraPerspectiveModel(0).then(
                      function(perspectiveModel) {
                        var cameraPerspectiveModel =
                            document.getElementById('cameraPerspectiveModel');
                        cameraPerspectiveModel.innerHTML =
                            'model: ' + perspectiveModel.model + '<br>' +
                            'focalLength: (' + perspectiveModel.focalLength.x + ', ' +
                                               perspectiveModel.focalLength.y + ')<br>' +
                            'principalPoint: (' + perspectiveModel.principalPoint.x + ', ' +
                                                  perspectiveModel.principalPoint.y + ')<br>' +
                            'skew: ' + perspectiveModel.skew + '<br>' +
                            'radialDistortion: [' + perspectiveModel.radialDistortion.k1 + ', ' +
                                                    perspectiveModel.radialDistortion.k2 + ', ' +
                                                    perspectiveModel.radialDistortion.k3 + ']<br>' +
                            'tangentialDistortion: [' +
                                perspectiveModel.tangentialDistortion.p1 + ', ' +
                                perspectiveModel.tangentialDistortion.p2 + ']<br>';
                      },
                      function() { });
                  currentPhoto.queryCameraPose(0).then(
                      function(pose) {
                        var cameraPose = document.getElementById('cameraPose');
                        cameraPose.innerHTML =
                            'transition: (' + pose.transition.x + ', ' +
                                              pose.transition.y + ', ' +
                                              pose.transition.z + ')<br>' +
                            'rotation: (' + pose.rotation.rotationAngle + ', ' +
                                            pose.rotation.rotationAxisX + ', ' +
                                            pose.rotation.rotationAxisY + ', ' +
                                            pose.rotation.rotationAxisZ + ')';
                      },
                      function() { });
                },
                function(e) { statusElement.innerHTML = e; });
          } else {
            statusElement.innerHTML = 'This is not a XDM file. Load failed.';
          }
        },
        function(e) { statusElement.innerHTML = e; });
  });
}
