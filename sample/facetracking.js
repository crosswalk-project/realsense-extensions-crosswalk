var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var detectionCheckbox = document.getElementById('enableDetection');
var landmarksCheckbox = document.getElementById('enableLandmarks');

var colorImageSizeElement = document.getElementById('2DSize');
var depthImageSizeElement = document.getElementById('3DSize');
var statusElement = document.getElementById('status');

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

function main() {
  ft = realsense.Face;

  var processed_sample_fps = new Stats();
  processed_sample_fps.domElement.style.position = 'absolute';
  processed_sample_fps.domElement.style.top = '0px';
  processed_sample_fps.domElement.style.right = '0px';
  document.getElementById('color_container').appendChild(processed_sample_fps.domElement);

  //detectionCheckbox.checked = true;

  var getting_processed_sample = false;
  ft.onprocessedsample = function(e) {
    if (getting_processed_sample)
      return;
    getting_processed_sample = true;
    ft.getProcessedSample().then(function(processed_sample) {
      colorImageSizeElement.innerHTML =
          '2D(' + processed_sample.color.width + ', ' +
          processed_sample.color.height + ')';
      color_canvas.width = processed_sample.color.width;
      color_canvas.height = processed_sample.color.height;

      if (!color_image_data) {
        color_image_data = color_context.createImageData(
            processed_sample.color.width, processed_sample.color.height);
      }
      color_image_data.data.set(processed_sample.color.data);
      color_context.putImageData(color_image_data, 0, 0);

      // Get traced faces.
      for (var i = 0; i < processed_sample.faceResults.faces.length; ++i) {
        var face = processed_sample.faceResults.faces[i];
        // Draw rects on every tracked faces.
        if (face.detection) {
          var rect = face.detection.boundingRect;
          //statusElement.innerHTML = 'Status: face rect is ('
          //    + rect.x + ' ' + rect.y + ' ' + rect.w + ' ' + rect.h + ')';
          color_context.strokeStyle = 'red';
          color_context.strokeRect(rect.x, rect.y, rect.w, rect.h);
          console.log('Face No.' + i + ': boundingRect: ' +
              rect.x + ' ' + rect.y + ' ' + rect.w + ' ' + rect.h +
              ' avgDepth: ' + face.detection.avgDepth);
        }
        // Draw landmark points on every tracked faces.
        if (face.landmark) {
          for (var i = 0; i < face.landmark.points.length; ++i) {
            var landmark_point = face.landmark.points[i];
            color_context.font = '6px';
            if (landmark_point.confidenceImage) {
              // White color for confidence point.
              color_context.fillStyle = 'white';
              color_context.fillText('*',
                  landmark_point.coordinateImage.x - 3, landmark_point.coordinateImage.y - 3);
            } else {
              // Red color for non-confidence point.
              color_context.fillStyle = 'red';
              color_context.fillText('x',
                  landmark_point.coordinateImage.x - 3, landmark_point.coordinateImage.y - 3);
            }
          }
        }
      }

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

  startButton.onclick = function(e) {
    getting_processed_sample = false;
    ft.start({
      enableDetection: detectionCheckbox.checked,
      enableLandmarks: landmarksCheckbox.checked}).then(
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
}
