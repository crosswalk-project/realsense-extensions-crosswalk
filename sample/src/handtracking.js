var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
startButton.disabled = true;
stopButton.disabled = true;

var imageCanvas = document.getElementById('image');
var imageContext = imageCanvas.getContext('2d');
var overlayCanvas = document.getElementById('overlay');
var overlayContext = overlayCanvas.getContext('2d');
var contourCanvas = document.getElementById('contourOverlay');
var contourContext = contourCanvas.getContext('2d');
imageCanvas.width = overlayCanvas.width = contourCanvas.width = 640;
imageCanvas.height = overlayCanvas.height = contourCanvas.height = 480;
imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
contourContext.clearRect(0, 0, contourCanvas.width, contourCanvas.height);

var statusSpan = document.getElementById('status');

var depthImageRadio = document.getElementById('depthimage');
var segmentationImageRadio = document.getElementById('segmetationimage');

var fpsCounter = new Stats();
fpsCounter.domElement.style.position = 'absolute';
fpsCounter.domElement.style.top = '0px';
fpsCounter.domElement.style.left = '0px';
document.body.appendChild(fpsCounter.domElement);

var handModule;
var stopped = true;

var lineWidth = 3;

var showTrackedJoints = true;
var drawExtremePoints = document.getElementById('extremities');
drawExtremePoints.checked = false;
var drawJoints = document.getElementById('joints');
drawJoints.checked = true;
var drawSkeleton = document.getElementById('skeleton');
drawSkeleton.checked = true;
var drawContour = document.getElementById('contours');
drawContour.checked = false;
var showImage = document.getElementById('showimage');
showImage.checked = true;
showImage.onchange = function(e) {
  if (e.target.checked) {
    depthImageRadio.disabled = segmentationImageRadio.disabled = false;
  } else {
    depthImageRadio.disabled = segmentationImageRadio.disabled = true;
  }
};

var mirror = document.getElementById('mirror');
mirror.checked = true;
mirror.onchange = function(e) {
  if (e.target.checked) {
    overlayCanvas.style.transform = imageCanvas.style.transform = 'scale(-1, 1)';
  } else {
    overlayCanvas.style.transform = imageCanvas.style.transform = '';
  }
};

var showDepthImage = false;

var handData;
var handDataUpdated = false;

var depthImage;
var depthImageUpdated = false;

var segmentationImages = [];
var segmentationImagesUpdated = false;

var contours = [];
var contoursUpdated = false;

function trackHands() {
  handModule.track().then(
      function(data) {
        handData = data;
        handDataUpdated = true;
        if (showImage.checked) {
          if (depthImageRadio.checked)
            updateDepthImage(handModule);
          else
            updateSegmentationImage(handData);
        }

        if (drawContour.checked) {
          updateContourData(handData);
        }

        fpsCounter.update();

        if (!stopped)
          trackHands();
      },
      function(e) {
        statusSpan.innerHTML = e.message;
      }
  );
}

function updateDepthImage(handModule) {
  handModule.getDepthImage().then(
      function(image) {
        depthImage = image;
        depthImageUpdated = true;
      },
      handleError
  );
}

function updateSegmentationImage(hands) {
  var numOfHands = hands.length;
  var updatedHands = 0;
  var segmentationImagesBack = [];
  for (var i in hands) {
    var hand = hands[i];
    hand.getSegmentationImage().then(
        function(image) {
          segmentationImagesBack.push(image);
          updatedHands++;
          if (updatedHands === numOfHands) {
            segmentationImagesUpdated = true;
            segmentationImages = segmentationImagesBack;
          }
        },
        handleError
    );
  }
}

function updateContourData(hands) {
  var numOfHands = hands.length;
  var updatedHands = 0;
  var contoursBack = [];
  for (var i in hands) {
    var hand = hands[i];
    hand.getContours().then(
        function(contourData) {
          for (var i = 0; i < contourData.length; ++i) {
            contoursBack.push(contourData[i]);
          }
          updatedHands++;
          if (updatedHands === numOfHands) {
            contoursUpdated = true;
            contours = contoursBack;
          }
        },
        handleError
    );
  }
}

function render() {
  renderImageData();
  renderHandData();
  renderContourData();
  requestAnimationFrame(render);
}

var isRenderContour = drawContour.checked;
function renderContourData() {
  if (!drawContour.checked) {
    if (isRenderContour) {
      requestAnimationFrame(function() {
        contourContext.clearRect(0, 0, contourCanvas.width, contourCanvas.height);
      });
      isRenderContour = drawContour.checked;
    }
    return;
  }
  isRenderContour = drawContour.checked;

  if (!contoursUpdated)
    return;

  contourContext.clearRect(0, 0, contourCanvas.width, contourCanvas.height);
  contourContext.strokeStyle = 'rgb(51,153,255)';
  contourContext.lineWidth = 3;
  for (var j = 0; j < contours.length; ++j) {
    var points = contours[j].points;
    contourContext.beginPath();
    for (var k = 0; k < points.length; ++k) {
      var point = points[k];
      if (k == 0)
        contourContext.moveTo(point.x, point.y);
      else
        contourContext.lineTo(point.x, point.y);
    }
    contourContext.closePath();
    contourContext.stroke();
  }
  contoursUpdated = false;
}

function renderSegmentationImage() {
  if (!segmentationImagesUpdated)
    return;
  var imageData = imageContext.createImageData(imageCanvas.width, imageCanvas.height);
  for (var i = 0; i < segmentationImages.length; ++i) {
    var segmentationImageData = segmentationImages[i].data;
    for (var j = 0; j < segmentationImageData.length; j++) {
      if (segmentationImageData[j] == 0xFF) {
        imageData.data[j * 4] = 100;
        imageData.data[j * 4 + 1] = 100;
        imageData.data[j * 4 + 2] = 100;
      }
      imageData.data[j * 4 + 3] = 255;
    }
  }
  imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  imageContext.putImageData(imageData, 0, 0);

  segmentationImagesUpdated = false;
}

function renderDepthImage() {
  if (!depthImageUpdated)
    return;
  imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
  var imageData = imageContext.createImageData(depthImage.width, depthImage.height);
  RSUtils.ConvertDepthToRGBUsingHistogram(
      depthImage, [255, 255, 255], [0, 0, 0], imageData.data);
  imageContext.putImageData(imageData, 0, 0);
  depthImageUpdated = false;
}

var isRenderImage = showImage.checked;
function renderImageData() {
  if (!showImage.checked) {
    if (isRenderImage) {
      requestAnimationFrame(function() {
        imageContext.clearRect(0, 0, imageCanvas.width, imageCanvas.height);
      });
      isRenderImage = showImage.checked;
    }
    return;
  }
  isRenderImage = showImage.checked;

  if (depthImageRadio.checked)
    renderDepthImage();
  else
    renderSegmentationImage();
}

function checkRenderHandData() {
  return (drawSkeleton.checked || drawExtremePoints.checked || drawJoints.checked);
}

var isRenderHandData = checkRenderHandData();
function renderHandData() {
  if (!checkRenderHandData()) {
    if (isRenderHandData) {
      requestAnimationFrame(function() {
        overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      });
      isRenderHandData = checkRenderHandData();
    }
    return;
  }
  isRenderHandData = checkRenderHandData();

  if (!handDataUpdated)
    return;

  function drawArc(center, radius, color) {
    overlayContext.strokeStyle = color;
    overlayContext.lineWidth = lineWidth;
    overlayContext.beginPath();
    overlayContext.arc(center.x, center.y, radius, 0, Math.PI * 2, true);
    overlayContext.stroke();
  }
  overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  for (var index in handData) {
    var hand = handData[index];
    if (drawExtremePoints.checked) {
      for (var property in hand.extremityPoints) {
        var radius = 2;
        var point = hand.extremityPoints[property];
        drawArc(point.pointImage, radius, 'red');
      }
    }
    if (drawJoints.checked || drawSkeleton.checked) {
      var joints;
      if (showTrackedJoints)
        joints = hand.trackedJoints;
      else
        joints = hand.normalizedJoints;
      if (drawSkeleton.checked) {
        overlayContext.strokeStyle = 'rgb(51,153,255)';
        overlayContext.lineWidth = 3;
        function drawFingerSkeleton(wrist, finger) {
          overlayContext.beginPath();
          overlayContext.moveTo(wrist.positionImage.x, wrist.positionImage.y);
          overlayContext.lineTo(finger.base.positionImage.x, finger.base.positionImage.y);
          overlayContext.moveTo(finger.base.positionImage.x, finger.base.positionImage.y);
          overlayContext.lineTo(finger.joint1.positionImage.x, finger.joint1.positionImage.y);
          overlayContext.moveTo(finger.joint1.positionImage.x, finger.joint1.positionImage.y);
          overlayContext.lineTo(finger.joint2.positionImage.x, finger.joint2.positionImage.y);
          overlayContext.moveTo(finger.joint2.positionImage.x, finger.joint2.positionImage.y);
          overlayContext.lineTo(finger.tip.positionImage.x, finger.tip.positionImage.y);
          overlayContext.moveTo(finger.tip.positionImage.x, finger.tip.positionImage.y);
          overlayContext.stroke();
        }
        drawFingerSkeleton(joints.wrist, joints.thumb);
        drawFingerSkeleton(joints.wrist, joints.index);
        drawFingerSkeleton(joints.wrist, joints.middle);
        drawFingerSkeleton(joints.wrist, joints.ring);
        drawFingerSkeleton(joints.wrist, joints.pinky);
      }

      if (drawJoints.checked) {
        var radius = 2;
        drawArc(joints.wrist.positionImage, radius, 'black');
        drawArc(joints.center.positionImage, radius + 4, 'red');
        function drawFingerJoints(finger, radius, color) {
          drawArc(finger.base.positionImage, radius, color);
          drawArc(finger.joint1.positionImage, radius, color);
          drawArc(finger.joint2.positionImage, radius, color);
          drawArc(finger.tip.positionImage, radius + 3, color);
        }
        drawFingerJoints(joints.thumb, radius, 'green');
        drawFingerJoints(joints.index, radius, 'rgb(0,102,204)');
        drawFingerJoints(joints.middle, radius, 'rgb(245,245,0)');
        drawFingerJoints(joints.ring, radius, 'rgb(0,245,245)');
        drawFingerJoints(joints.pinky, radius, 'rgb(255,184,112)');
      }
    }
  }

  handDataUpdated = false;
}

function handleError(e) {
  statusSpan.innerHTML = e;
}

function setImageSize(imageSize) {
  imageCanvas.width = imageSize.width;
  imageCanvas.height = imageSize.height;
  imageContext = imageCanvas.getContext('2d');
  overlayCanvas.width = imageSize.width;
  overlayCanvas.height = imageSize.height;
  contourContext = contourCanvas.getContext('2d');
  contourCanvas.width = imageSize.width;
  contourCanvas.height = imageSize.height;
  contourContext = contourCanvas.getContext('2d');
  statusSpan.innerHTML = 'start succeeds: image size (' +
      imageSize.width + 'x' + imageSize.height + ')';
}

function main() {
  try {
    handModule = new realsense.Hand.HandModule();
  } catch (e) {
    statusSpan.innerHTML = e.message;
  }
  handModule.init().then(
      function() {
        statusSpan.innerHTML = 'init succeeds.';
        startButton.disabled = false;
        stopButton.disabled = false;
      },
      handleError
  );
  startButton.onclick = function(e) {
    handModule.start().then(
        function(imageSize) {
          setImageSize(imageSize);
          stopped = false;
          trackHands();
        },
        handleError
    );
  };
  stopButton.onclick = function(e) {
    stopped = true;
    handModule.stop().then(
        function() {
          statusSpan.innerHTML = 'close succeeds.';
        },
        handleError
    );
  };

  render();
}
