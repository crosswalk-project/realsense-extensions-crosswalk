var enhancedPhotoPageReady = (function() {

  var pageDom = null;
  var toast = null;

  var imageCanvas, overlayCanvas;
  var imageContext, imageData;
  var overlayContext;
  var refocus, depthMask, measurement, paster, photoUtils, XDMUtils;
  var currentPhoto, savePhoto;
  var canvasWidth, canvasHeight;

  var clickCount = 0;
  var startX = 0;
  var startY = 0;
  var endX = 0, endY = 0;
  var hasImage = false;
  var sticker;
  var hasSelectPoints = false;

  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  function errorCallback(error) {
    toastMessage(error.message);
  }

  function drawCross(x, y) {
    overlayContext.beginPath();
    overlayContext.strokeStyle = 'blue';
    overlayContext.lineWidth = 2;
    overlayContext.moveTo(x - 7, y - 7);
    overlayContext.lineTo(x + 7, y + 7);
    overlayContext.stroke();
    overlayContext.moveTo(x + 7, y - 7);
    overlayContext.lineTo(x - 7, y + 7);
    overlayContext.stroke();
    overlayContext.closePath();
  }

  function measureDistance(e) {
    if (hasImage == false)
      return;

    clickCount = clickCount + 1;
    var x = parseInt((e.clientX - overlayCanvas.offsetLeft) *
        canvasWidth / imageCanvas.scrollWidth);
    var y = parseInt((e.clientY - overlayCanvas.offsetTop) *
        canvasHeight / imageCanvas.scrollHeight);
    if (clickCount % 2 == 0) {
      drawCross(x, y);
      overlayContext.beginPath();
      overlayContext.moveTo(startX, startY);
      overlayContext.lineTo(x, y);
      overlayContext.strokeStyle = 'blue';
      overlayContext.lineWidth = 2;
      overlayContext.stroke();
      overlayContext.closePath();
      measurement.measureDistance(currentPhoto, { x: startX, y: startY }, { x: x, y: y }).then(
          function(d) {
            toastMessage('Distance between(' +
                startX + ',' + startY + ') - (' + x + ',' + y + ') = ' +
                parseFloat(d.distance).toFixed(2) + ' millimeters, Confidence = ' +
                parseFloat(d.confidence).toFixed(2) + ', Precision=' +
                parseFloat(d.precision).toFixed(2) + 'mm');
            overlayContext.fillStyle = 'blue';
            overlayContext.font = 'bold 14px Arial';
            overlayContext.fillText(
                parseFloat(d.distance).toFixed(2) + ' mm',
                (startX + x) / 2, (startY + y) / 2 - 5);
          }, errorCallback);
    } else {
      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      drawCross(x, y);
      startX = x;
      startY = y;
    }
  }

  function depthRefocus(e) {
    if (hasImage == false)
      return;

    var x = parseInt((e.clientX - overlayCanvas.offsetLeft) *
        canvasWidth / imageCanvas.scrollWidth);
    var y = parseInt((e.clientY - overlayCanvas.offsetTop) *
        canvasHeight / imageCanvas.scrollHeight);

    overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
    drawCross(x, y);

    refocus.init(currentPhoto).then(
        function(success) {
          refocus.apply({ x: x, y: y }, 50.0).then(
              function(photo) {
                savePhoto = photo;
                photo.queryContainerImage().then(
                    function(image) {
                      imageData = imageContext.createImageData(image.width, image.height);
                      toastMessage('Depth refocus success. Please select focus point again.');
                      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
                      imageData.data.set(image.data);
                      imageContext.putImageData(imageData, 0, 0);
                    }, errorCallback);
              }, errorCallback);
        }, errorCallback);
  }

  function doPasteOnPlane() {
    if (!hasImage || !pageDom.$.pasteOnPlaneButton.active || !paster)
      return;

    if (!hasSelectPoints) {
      toastMessage(
          'Select two points on the image to paste the sticker.');
      return;
    }

    var coordX = parseInt((startX + endX) / 2);
    var coordY = parseInt((startY + endY) / 2);
    const PI = 3.14159265;
    var rotation = 90 - 180 / PI * Math.atan2((endY - startY), (endX - startX));
    var stickerData = {
      height: -1,
      rotation: rotation,
      isCenter: true
    };

    paster.setPhoto(currentPhoto).then(
        function(success) {
          paster.setSticker(sticker, { x: coordX, y: coordY }, stickerData).then(
              function(success) {
                paster.paste().then(
                    function(photo) {
                      savePhoto = photo;
                      photo.queryContainerImage().then(
                          function(image) {
                            toastMessage('Finished paste on plane.');
                            imageData.data.set(image.data);
                            imageContext.putImageData(imageData, 0, 0);
                          }, errorCallback);
                    }, errorCallback);
              }, errorCallback);
        }, errorCallback);
  }

  function pasteOnPlane(e) {
    if (hasImage == false || !sticker)
      return;

    clickCount = clickCount + 1;
    endX = parseInt((e.clientX - overlayCanvas.offsetLeft) *
        canvasWidth / imageCanvas.scrollWidth);
    endY = parseInt((e.clientY - overlayCanvas.offsetTop) *
        canvasHeight / imageCanvas.scrollHeight);
    if (clickCount % 2 == 0) {
      drawCross(endX, endY);
      overlayContext.beginPath();
      overlayContext.moveTo(startX, startY);
      overlayContext.lineTo(endX, endY);
      overlayContext.strokeStyle = 'blue';
      overlayContext.lineWidth = 2;
      overlayContext.stroke();
      overlayContext.closePath();

      hasSelectPoints = true;
      doPasteOnPlane();
    } else {
      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      drawCross(endX, endY);
      startX = endX;
      startY = endY;
    }
  }

  function popColor(e) {
    if (hasImage == false)
      return;

    var x = parseInt((e.clientX - overlayCanvas.offsetLeft) *
        canvasWidth / imageCanvas.scrollWidth);
    var y = parseInt((e.clientY - overlayCanvas.offsetTop) *
        canvasHeight / imageCanvas.scrollHeight);

    overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
    drawCross(x, y);

    depthMask.init(currentPhoto).then(
        function(success) {
          depthMask.computeFromCoordinate({ x: x, y: y }).then(
              function(maskImage) {
                currentPhoto.queryContainerImage().then(
                    function(colorImage) {
                      for (var x = 0; x < colorImage.width; x++) {
                        for (var y = 0; y < colorImage.height; y++) {
                          var index = y * colorImage.width * 4 + x * 4;
                          var maskIndex = y * maskImage.width + x;
                          var alpha = 1.0 - maskImage.data[maskIndex];

                          // BGR
                          var grey = 0.0722 * colorImage.data[index + 2] +
                              0.7152 * colorImage.data[index + 1] + 0.2126 * colorImage.data[index];

                          colorImage.data[index] =
                              parseInt(colorImage.data[index] * (1 - alpha) + grey * (alpha));
                          colorImage.data[index + 1] =
                              parseInt(colorImage.data[index + 1] * (1 - alpha) + grey * (alpha));
                          colorImage.data[index + 2] =
                              parseInt(colorImage.data[index + 2] * (1 - alpha) + grey * (alpha));
                        }
                      }

                      imageContext.clearRect(0, 0, canvasWidth, canvasHeight);
                      imageData = imageContext.createImageData(colorImage.width, colorImage.height);
                      imageData.data.set(colorImage.data);
                      imageContext.putImageData(imageData, 0, 0);

                      currentPhoto.clone().then(
                          function(photo) {
                            savePhoto = photo;
                            savePhoto.setContainerImage(colorImage).then(
                                function() {
                                  toastMessage(
                                      'Finish processing color pop, select again!');
                                }, errorCallback);
                          }, errorCallback);
                    }, errorCallback);
              }, errorCallback);
        }, errorCallback);
  }

  function initPage(dom) {
    pageDom = dom;
    toast = pageDom.$.toast;

    try {
      refocus = new realsense.DepthEnabledPhotography.DepthRefocus();
      depthMask = new realsense.DepthEnabledPhotography.DepthMask();
      measurement = new realsense.DepthEnabledPhotography.Measurement();
    } catch (e) {
      errorCallback(e);
      return;
    }

    photoUtils = realsense.DepthEnabledPhotography.photoUtils;
    XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

    imageCanvas = pageDom.$.image;
    imageContext = imageCanvas.getContext('2d');
    overlayCanvas = pageDom.$.overlay;
    overlayContext = overlayCanvas.getContext('2d');

    var loadPhoto = pageDom.$.loadPhoto.inputElement;
    var fileInput = pageDom.$.setStickerButton.inputElement;

    function resetAllButtonStates() {
      pageDom.$.measureButton.active = false;
      pageDom.$.refocusButton.active = false;
      pageDom.$.pasteOnPlaneButton.active = false;
      pageDom.$.colorPopButton.active = false;
    }
    function selectButtonInGroup(selectedButton) {
      resetAllButtonStates();
      selectedButton.active = true;
    }

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
                          resetAllButtonStates();
                          canvasWidth = image.width;
                          canvasHeight = image.height;
                          imageCanvas.width = canvasWidth;
                          imageCanvas.height = canvasHeight;
                          overlayCanvas.width = canvasWidth;
                          overlayCanvas.height = canvasHeight;
                          imageData = imageContext.createImageData(image.width, image.height);
                          toastMessage('Load successfully.');
                          imageData.data.set(image.data);
                          imageContext.putImageData(imageData, 0, 0);
                          hasImage = true;

                          photoUtils.getDepthQuality(currentPhoto).then(
                              function(quality) {
                                toastMessage(' The photo quality is ' + quality);
                              }, errorCallback);
                        }, errorCallback);
                  }, errorCallback);
            } else {
              toastMessage('This is not a XDM file. Load failed.');
            }
          }, errorCallback);
    };

    pageDom._onSaveTapped = function() {
      if (!savePhoto) {
        toastMessage('There is no photo to save');
        return;
      }
      XDMUtils.saveXDM(savePhoto).then(
          function(blob) {
            xwalk.experimental.native_file_system.requestNativeFileSystem('pictures',
                function(fs) {
                  var fileName = '/pictures/depthphoto_' + RSUtils.getDateString() + '.jpg';
                  fs.root.getFile(fileName, { create: true }, function(entry) {
                    entry.createWriter(function(writer) {
                      writer.onwriteend = function(e) {
                        toastMessage('The depth photo has been saved to ' +
                            fileName + ' successfully.');
                      };
                      writer.onerror = function(e) {
                        toastMessage('Failed to save depth photo.');
                      };
                      writer.write(blob);
                    }, errorCallback);
                  }, errorCallback);
                });
          }, errorCallback);
    };

    pageDom._onSetStickerChanged = function(e) {
      var file = fileInput.files[0];
      var imageType = /image.*/;

      if (file.type.match(imageType)) {
        var reader = new FileReader();

        reader.onload = function(e) {
          var pastedImage = new Image();
          pastedImage.src = reader.result;

          var tempCanvas = document.createElement('canvas');
          var tempContext = tempCanvas.getContext('2d');
          tempContext.drawImage(pastedImage, 0, 0);
          var pastedImageData = tempContext.getImageData(
              0, 0, pastedImage.width, pastedImage.height);

          sticker = {
            format: 'rgb32',
            width: pastedImage.width,
            height: pastedImage.height,
            data: pastedImageData.data
          };

          doPasteOnPlane();
        };

        reader.readAsDataURL(file);
      } else {
        toastMessage('File not supported!');
      }
    };

    pageDom._onMeasureTapped = function() {
      selectButtonInGroup(pageDom.$.measureButton);
      if (hasImage == false) {
        toastMessage('Please load a photo first.');
        return;
      }

      toastMessage('Select two points to measure distance.');
      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, canvasWidth, canvasHeight);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          }, errorCallback);
    };

    pageDom._onRefocusTapped = function() {
      selectButtonInGroup(pageDom.$.refocusButton);
      if (hasImage == false) {
        toastMessage('Please load a photo first.');
        return;
      }

      toastMessage('Select the refocus point.');
      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, canvasWidth, canvasHeight);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          }, errorCallback);
    };

    pageDom._onPasteOnPlaneTapped = function() {
      selectButtonInGroup(pageDom.$.pasteOnPlaneButton);
      if (hasImage == false) {
        toastMessage('Please load a photo first.');
        return;
      }

      if (!paster) {
        paster = new realsense.DepthEnabledPhotography.Paster();
      }

      pageDom.$.setStickerButton.disabled = false;

      if (!sticker) {
        toastMessage('Please click [Set Sticker] button to load the pasted image.');
      } else {
        toastMessage('Select two points on the image to paste the sticker.');
      }

      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, canvasWidth, canvasHeight);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          }, errorCallback);
    };

    pageDom._onColorPopTapped = function() {
      selectButtonInGroup(pageDom.$.colorPopButton);
      if (hasImage == false) {
        toastMessage('Please load a photo first.');
        return;
      }

      toastMessage('Select the point to pop color.');
      overlayContext.clearRect(0, 0, canvasWidth, canvasHeight);
      currentPhoto.queryContainerImage().then(
          function(image) {
            imageContext.clearRect(0, 0, canvasWidth, canvasHeight);
            imageData = imageContext.createImageData(image.width, image.height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
          }, errorCallback);
    };

    pageDom._onOverlayCanvasTapped = function(e) {
      if (pageDom.$.measureButton.active) {
        measureDistance(e.detail.sourceEvent);
      }
      if (pageDom.$.refocusButton.active) {
        depthRefocus(e.detail.sourceEvent);
      }
      if (pageDom.$.pasteOnPlaneButton.active) {
        pasteOnPlane(e.detail.sourceEvent);
      }
      if (pageDom.$.colorPopButton.active) {
        popColor(e.detail.sourceEvent);
      }
    };
  };

  return function(dom) {
    initPage(dom);
  };
})();
