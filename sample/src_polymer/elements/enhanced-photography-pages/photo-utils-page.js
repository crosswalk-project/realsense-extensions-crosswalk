var photoUtilsPageReady = (function() {

  var pageDom = null;
  var toast = null;

  var photoUtils, XDMUtils;
  var imageCanvas, overlayCanvas;
  var imageContext, overlayContext, imageData;
  var currentPhoto, savePhoto;
  var width, height;

  var topX, topY, bottomX, bottomY;
  var hasImage = false;

  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  function errorCallback(error) {
    toastMessage(error.message);
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
    RSUtils.ConvertDepthToRGBUsingHistogram(
        image, [255, 255, 255], [0, 0, 0], imageData.data);
    imageContext.putImageData(imageData, 0, 0);
  }

  function relMouseCoords(event) {
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = this;

    do {
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    }
    while (currentElement = currentElement.offsetParent);

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    return { x: canvasX, y: canvasY };
  }

  HTMLCanvasElement.prototype.relMouseCoords = relMouseCoords;

  function colorResize() {
    photoUtils.colorResize(currentPhoto, 1280).then(
        function(photo) {
          savePhoto = photo;
          photo.queryContainerImage().then(
              function(image) {
                fillCanvasUsingColorImage(image);
                toastMessage('colorResize success.');
              },
              errorCallback);
        },
        errorCallback);
  }

  function commonFOV() {
    photoUtils.commonFOV(currentPhoto).then(
        function(photo) {
          savePhoto = photo;
          photo.queryContainerImage().then(
              function(image) {
                fillCanvasUsingColorImage(image);
                toastMessage('commonFOV success.');
              },
              errorCallback);
        },
        errorCallback);
  }

  function depthEnhance() {
    var before = new Date().getTime();
    photoUtils.enhanceDepth(currentPhoto, 'high').then(
        function(photo) {
          var after = new Date().getTime();
          var diff = after - before;
          savePhoto = photo;
          photo.queryDepth().then(
              function(image) {
                fillCanvasUsingDepthImage(image);
                toastMessage('enhanceDepth success. It costs ' + diff + ' milliseconds.');
              }, errorCallback);
        }, errorCallback);
  }

  function depthResize() {
    photoUtils.depthResize(currentPhoto, 640).then(
        function(photo) {
          savePhoto = photo;
          photo.queryDepth().then(
              function(image) {
                fillCanvasUsingDepthImage(image);
                toastMessage('depthResize success.');
              }, errorCallback);
        }, errorCallback);
  }

  function depthQuality() {
    photoUtils.getDepthQuality(currentPhoto).then(
        function(quality) {
          toastMessage('Depth qulity = ' + quality);
        }, errorCallback);
  }

  function photoCrop() {
    var startX = Math.min(topX, bottomX);
    var startY = Math.min(topY, bottomY);
    var endX = Math.max(topX, bottomX);
    var endY = Math.max(topY, bottomY);
    photoUtils.photoCrop(currentPhoto,
                         { x: startX,
                           y: startY,
                           w: (endX - startX),
                           h: (endY - startY)}).then(
        function(photo) {
          savePhoto = photo;
          photo.queryContainerImage().then(
              function(image) {
                overlayContext.clearRect(0, 0, width, height);
                fillCanvasUsingColorImage(image);
                toastMessage('photoCrop success');
              }, errorCallback);
        }, errorCallback);
  }

  function photoRotate() {
    photoUtils.photoRotate(currentPhoto, 90.0).then(
        function(photo) {
          savePhoto = photo;
          photo.queryContainerImage().then(
              function(image) {
                fillCanvasUsingColorImage(image);
                toastMessage('photoRotate success');
              },
              errorCallback);
        },
        errorCallback);
  }

  function initPage(dom) {
    pageDom = dom;
    toast = pageDom.$.toast;
    var loadPhoto = pageDom.$.loadPhoto.inputElement;

    photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;
    XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

    imageCanvas = pageDom.$.image;
    overlayCanvas = pageDom.$.overlay;
    imageContext = imageCanvas.getContext('2d');
    overlayContext = overlayCanvas.getContext('2d');

    function selectButtonInGroup(selectedButton) {
      pageDom.$.colorResizeButton.active = false;
      pageDom.$.commonFOVButton.active = false;
      pageDom.$.depthResizeButton.active = false;
      pageDom.$.depthEnhanceButton.active = false;
      pageDom.$.depthQualityButton.active = false;
      pageDom.$.photoCropButton.active = false;
      pageDom.$.photoRotateButton.active = false;

      selectedButton.active = true;
    }

    pageDom._onOverlayTracking = function(event) {
      if (!hasImage || !pageDom.$.photoCropButton.active)
        return;
      var e = event.detail.sourceEvent;
      var coords = overlayCanvas.relMouseCoords(e);
      switch (event.detail.state) {
        case 'start':
          topX = parseInt((e.clientX - overlayCanvas.offsetLeft) *
              width / imageCanvas.scrollWidth);
          topY = coords.y;
          break;
        case 'track':
          bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) *
              width / imageCanvas.scrollWidth);
          bottomY = coords.y;
          overlayContext.clearRect(0, 0, width, height);
          var offsetX = bottomX - topX;
          var offsetY = bottomY - topY;
          overlayContext.strokeStyle = 'red';
          overlayContext.lineWidth = 2;
          overlayContext.strokeRect(topX, topY, offsetX, offsetY);
          break;
        case 'end':
          bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) *
              width / imageCanvas.scrollWidth);
          bottomY = coords.y;
          photoCrop();
          break;
      }
    };

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
                          width = image.width;
                          height = image.height;
                          imageCanvas.width = width;
                          imageCanvas.height = height;
                          overlayCanvas.width = width;
                          overlayCanvas.height = height;
                          fillCanvasUsingColorImage(image);
                          toastMessage('Load successfully.');
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

    pageDom._onColorResizeTapped = function() {
      selectButtonInGroup(pageDom.$.colorResizeButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      colorResize();
    };

    pageDom._onCommonFOVTapped = function() {
      selectButtonInGroup(pageDom.$.commonFOVButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      commonFOV();
    };

    pageDom._onDepthResizeTapped = function() {
      selectButtonInGroup(pageDom.$.depthResizeButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      depthEnhance();
    };

    pageDom._onDepthEnhanceTapped = function() {
      selectButtonInGroup(pageDom.$.depthEnhanceButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      depthResize();
    };

    pageDom._onDepthQualityTapped = function() {
      selectButtonInGroup(pageDom.$.depthQualityButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      depthQuality();
    };

    pageDom._onPhotoCropTapped = function() {
      selectButtonInGroup(pageDom.$.photoCropButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      currentPhoto.queryContainerImage().then(
          function(image) {
            fillCanvasUsingColorImage(image);
            toastMessage('Please select the cropped field.');
          },
          errorCallback);
    };

    pageDom._onPhotoRotateTapped = function() {
      selectButtonInGroup(pageDom.$.photoRotateButton);
      if (hasImage === false) {
        toastMessage('Please capture and load a depth photo first.');
        return;
      }
      photoRotate();
    };

  };

  return function(dom) {
    initPage(dom);
  };
})();
