var segmentationPageReady = (function() {

  var pageDom = null;
  var toast = null;

  const FirstClick = 0, SecondClick = 1, TraceClicks = 2;
  var segmentation, photoUtils, XDMUtils;
  var imageCanvas, overlayCanvas;
  var imageContext, imageData, overlayContext;
  var currentPhoto, savePhoto;

  var width, height;
  var curPhotoWidth, curPhotoHeight;
  var topX, topY, bottomX, bottomY;
  var lastX = -1, lastY = -1;
  var nextClick = FirstClick;
  var hasImage = false;
  var stopDrawLine = false;
  var markupImgHints = [];
  var points = [];
  var foreground;
  var isLeftButtonDown = false, isRightButtonDown = false;

  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  function errorCallback(error) {
    toastMessage(error.message);
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

  function doBlendColorPop(colorImage, maskImage) {
    var GREY = 0x7f;
    var alpha;
    for (var x = 0; x < colorImage.width; x++) {
      for (var y = 0; y < colorImage.height; y++) {
        var index = y * colorImage.width * 4 + x * 4;
        var maskIndex = y * maskImage.width + x;
        var mask = maskImage.data[maskIndex];
        if (mask > 0) alpha = 1.0;
        else alpha = 0.0;

        colorImage.data[index] = parseInt(alpha * colorImage.data[index] +
            (1 - alpha) * ((colorImage.data[index] >> 4) + GREY));
        colorImage.data[index + 1] = parseInt(alpha * colorImage.data[index + 1] +
            (1 - alpha) * ((colorImage.data[index + 1] >> 4) + GREY));
        colorImage.data[index + 2] = parseInt(alpha * colorImage.data[index + 2] +
            (1 - alpha) * ((colorImage.data[index + 2] >> 4) + GREY));
      }
    }
  }

  function resetMarkupImgHints() {
    if (markupImgHints.length) markupImgHints = [];
    var len = curPhotoWidth * curPhotoHeight;
    for (var i = 0; i < len; i++) {
      markupImgHints[i] = 0;
    }
  }

  function resetPoints() {
    if (points.length) points = [];
  }

  function createInitialMask() {
    var value = 255;
    for (var y = topY; y != bottomY; y += (topY < bottomY) ? 1 : -1)
    {
      for (var x = topX; x != bottomX; x += (topX < bottomX) ? 1 : -1)
      {
        markupImgHints[y * curPhotoWidth + x] = value;
      }
    }
  }

  function connectMissedPixels(starts, ends) {
    if (starts.x == ends.x)
    {
      for (var y = starts.y; y != ends.y; y += (starts.y < ends.y) ? 1 : -1)
      {
        points.push({x: starts.x, y: y});
      }
    } else {
      var slope = (ends.y - starts.y) / parseFloat(ends.x - starts.x);

      for (var x = starts.x; x != ends.x; x += (starts.x < ends.x) ? 1 : -1)
      {
        var y = parseInt((slope * (x - starts.x) + starts.y) + 0.5);
        points.push({x: x, y: y});
      }
    }
  }

  function updateMarkupImage(pointX, pointY, isForeground) {
    points.push({x: pointX, y: pointY});

    foreground = isForeground;

    if (lastX == -1 && lastY == -1)
      points.push({ x: pointX, y: pointY });
    else
      connectMissedPixels({x: lastX, y: lastY}, {x: pointX, y: pointY});

    lastX = pointX;
    lastY = pointY;
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

    function handleTouchStart(e) {
      if (!hasImage)
        return;
      var coords = overlayCanvas.relMouseCoords(e);
      if (nextClick == FirstClick) {
        topX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
        topY = coords.y;
        nextClick = SecondClick;
      }
    }
    function handleTouchEnd(e) {
      if (!hasImage)
        return;
      var coords = overlayCanvas.relMouseCoords(e);
      if (nextClick == SecondClick) {
        bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width /
                imageCanvas.scrollWidth);
        bottomY = coords.y;

        createInitialMask();

        var markupImage = {
          format: 'Y8',
          width: curPhotoWidth,
          height: curPhotoHeight,
          data: markupImgHints
        };
        segmentation.objectSegment(currentPhoto, markupImage).then(
            function(maskImage) {
              currentPhoto.queryContainerImage().then(
                  function(colorImage) {
                    doBlendColorPop(colorImage, maskImage);

                    imageContext.clearRect(0, 0, width, height);
                    imageData = imageContext.createImageData(
                        colorImage.width, colorImage.height);
                    imageData.data.set(colorImage.data);
                    imageContext.putImageData(imageData, 0, 0);

                    currentPhoto.clone().then(
                        function(photo) {
                          savePhoto = photo;
                          savePhoto.setContainerImage(colorImage).then(
                              function() {
                                toastMessage('Finish processing segmentation!' +
                                    'Click and drag the left(foregroud) and right(background)' +
                                    'mouse buttons to refine the mask');
                                nextClick = TraceClicks;
                              },
                              function(e) { toastMessage(e.message); });
                        },
                        function(e) { toastMessage(e.message); });
                  },
                  function(e) { toastMessage(e.message); });
            },
            function(e) { toastMessage(e.message); });
      } else if (nextClick == TraceClicks) {
        stopDrawLine = false;
        resetPoints();
        var x = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
        var y = parseInt((e.clientY - overlayCanvas.offsetTop) * height / imageCanvas.scrollHeight);
        overlayContext.beginPath();
        if (pageDom.$.foregroundButton.active) {
          isLeftButtonDown = true;
          overlayContext.strokeStyle = 'blue';
          updateMarkupImage(x, y, true);
        } else {
          isRightButtonDown = true;
          overlayContext.strokeStyle = 'green';
          updateMarkupImage(x, y, false);
        }
        overlayContext.lineWidth = 0.5;
        overlayContext.moveTo(x, y);
      }
    };

    function handleTouchMove(e) {
      if (!hasImage || nextClick == FirstClick ||
          (nextClick == TraceClicks && !isLeftButtonDown && !isRightButtonDown))
        return;
      var coords = overlayCanvas.relMouseCoords(e);
      bottomX = parseInt((e.clientX - overlayCanvas.offsetLeft) * width / imageCanvas.scrollWidth);
      bottomY = coords.y;
      if (nextClick == SecondClick) {
        overlayContext.clearRect(0, 0, width, height);
        var offsetX = bottomX - topX;
        var offsetY = bottomY - topY;
        overlayContext.strokeStyle = 'red';
        overlayContext.lineWidth = 2;
        overlayContext.strokeRect(topX, topY, offsetX, offsetY);
      } else if (nextClick == TraceClicks && (isLeftButtonDown || isRightButtonDown)) {
        if (!stopDrawLine) {
          overlayContext.lineTo(bottomX, bottomY);
          overlayContext.stroke();
          // for precessing
          if (isLeftButtonDown) {
            updateMarkupImage(bottomX, bottomY, true);
          } else if (isRightButtonDown) {
            updateMarkupImage(bottomX, bottomY, false);
          }
        } else {
          overlayContext.closePath();
        }
      }
    };

    function handleTouchUp(e) {
      if (nextClick == TraceClicks) {
        if (pageDom.$.foregroundButton.active) {
          isLeftButtonDown = false;
        } else {
          isRightButtonDown = false;
        }
        stopDrawLine = true;
        lastX = lastY = -1;

        segmentation.refineMask(points, foreground).then(
            function(maskImage) {
              currentPhoto.queryContainerImage().then(
                  function(colorImage) {
                    doBlendColorPop(colorImage, maskImage);

                    imageContext.clearRect(0, 0, width, height);
                    imageData = imageContext.createImageData(
                        colorImage.width, colorImage.height);
                    imageData.data.set(colorImage.data);
                    imageContext.putImageData(imageData, 0, 0);

                    currentPhoto.clone().then(
                        function(photo) {
                          savePhoto = photo;
                          savePhoto.setContainerImage(colorImage).then(
                              function() {
                                toastMessage('Click and drag the left(foregroud) and' +
                                    'right(background) mouse buttons to refine the mask');
                              },
                              function(e) { toastMessage(e.message); });
                        },
                        function(e) { toastMessage(e.message); });
                  },
                  function(e) { toastMessage(e.message); });
            },
            function(e) { toastMessage(e.message); });
      }
    };

    pageDom._onForegroundButtonTapped = function() {
      if (pageDom.$.foregroundButton.active) {
        isLeftButtonDown = true;
        isRightButtonDown = false;
      } else {
        isLeftButtonDown = false;
        isRightButtonDown = true;
      }
    };

    pageDom._onOverlayTracking = function(event) {
      switch (event.detail.state) {
        case 'start':
          handleTouchStart(event.detail.sourceEvent);
          break;
        case 'track':
          handleTouchMove(event.detail.sourceEvent);
          break;
        case 'end':
          handleTouchEnd(event.detail.sourceEvent);
          break;
      }
    };

    pageDom._onOverlayUp = function(event) {
      handleTouchUp(event.detail.sourceEvent);
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
                        toastMessage(
                            'The depth photo has been saved to ' + fileName + ' successfully.');
                      };
                      writer.onerror = function(e) {
                        toastMessage('Failed to save depth photo.');
                      };
                      writer.write(blob);
                    },
                    function(e) { toastMessage(e); });
                  },
                  function(e) { toastMessage(e); });
                });
          },
          function(e) { toastMessage(e.message); });
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
                    if (!segmentation) {
                      try {
                        segmentation =
                            new realsense.DepthEnabledPhotography.Segmentation();
                      } catch (e) {
                        toastMessage(e.message);
                        return;
                      }
                    }

                    currentPhoto.queryContainerImage().then(
                        function(image) {
                          curPhotoWidth = image.width;
                          curPhotoHeight = image.height;
                          width = image.width;
                          height = image.height;
                          imageCanvas.width = width;
                          imageCanvas.height = height;
                          overlayCanvas.width = width;
                          overlayCanvas.height = height;
                          resetMarkupImgHints();
                          resetPoints();
                          nextClick = FirstClick;
                          imageContext.clearRect(0, 0, width, height);
                          imageData = imageContext.createImageData(image.width, image.height);
                          toastMessage('Select the bounding box around the object.');
                          overlayContext.clearRect(0, 0, width, height);
                          imageData.data.set(image.data);
                          imageContext.putImageData(imageData, 0, 0);
                          hasImage = true;
                          photoUtils.getDepthQuality(currentPhoto).then(
                              function(quality) {
                                toastMessage(' The photo quality is ' + quality);
                              },
                              function(e) { toastMessage(e.message); });
                        },
                        function(e) { toastMessage(e.message); });
                  },
                  function(e) { toastMessage(e.message); });
            } else {
              toastMessage('This is not a XDM file. Load failed.');
            }
          },
          function(e) { toastMessage(e.message); });
    };

    pageDom._onRestartTapped = function(e) {
      if (!hasImage) {
        toastMessage('Please load a photo.');
        return;
      }
      overlayContext.clearRect(0, 0, width, height);
      currentPhoto.queryContainerImage().then(
          function(image) {
            curPhotoWidth = image.width;
            curPhotoHeight = image.height;
            resetMarkupImgHints();
            resetPoints();
            nextClick = FirstClick;
            imageContext.clearRect(0, 0, width, height);
            imageData =
                imageContext.createImageData(image.width, image.height);
            toastMessage('Select the bounding box around the object.');
            overlayContext.clearRect(0, 0, width, height);
            imageData.data.set(image.data);
            imageContext.putImageData(imageData, 0, 0);
            hasImage = true;
          },
          function(e) { toastMessage(e.message); });
    };

    pageDom._onUndoTapped = function(e) {
      if (!segmentation || !hasImage) {
        toastMessage('Undo Scribble Error');
        return;
      }
      segmentation.undo().then(
          function(maskImage) {
            currentPhoto.queryContainerImage().then(
                function(colorImage) {
                  doBlendColorPop(colorImage, maskImage);

                  imageContext.clearRect(0, 0, width, height);
                  imageData = imageContext.createImageData(
                      colorImage.width, colorImage.height);
                  imageData.data.set(colorImage.data);
                  imageContext.putImageData(imageData, 0, 0);

                  currentPhoto.clone().then(
                      function(photo) {
                        savePhoto = photo;
                        savePhoto.setContainerImage(colorImage).then(
                            function() {
                              toastMessage('Undo Scribble Complete');
                            },
                            function(e) { toastMessage(e.message); });
                      },
                      function(e) { toastMessage(e.message); });
                },
                function(e) { toastMessage(e.message); });
          },
          function(e) { toastMessage(e.message); });
    };

    pageDom._onRedoTapped = function(e) {
      if (!segmentation || !hasImage) {
        toastMessage('Redo Scribble Error');
        return;
      }
      segmentation.redo().then(
          function(maskImage) {
            currentPhoto.queryContainerImage().then(
                function(colorImage) {
                  doBlendColorPop(colorImage, maskImage);

                  imageContext.clearRect(0, 0, width, height);
                  imageData = imageContext.createImageData(
                      colorImage.width, colorImage.height);
                  imageData.data.set(colorImage.data);
                  imageContext.putImageData(imageData, 0, 0);

                  currentPhoto.clone().then(
                      function(photo) {
                        savePhoto = photo;
                        savePhoto.setContainerImage(colorImage).then(
                            function() {
                              toastMessage('Redo Scribble Complete');
                            },
                            function(e) { toastMessage(e.message); });
                      },
                      function(e) { toastMessage(e.message); });
                },
                function(e) { toastMessage(e.message); });
          },
          function(e) { toastMessage(e.message); });
    };

  }

  return function(dom) {
    initPage(dom);
  };
})();
