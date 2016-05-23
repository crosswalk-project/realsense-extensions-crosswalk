var RSUtils = {
  'getDateString': function getDateString() {
    var date = new Date();
    var dateString =
        date.getFullYear() +
        ('0' + (date.getMonth() + 1)).slice(-2) +
        ('0' + date.getDate()).slice(-2) +
        ('0' + date.getHours()).slice(-2) +
        ('0' + date.getMinutes()).slice(-2) +
        ('0' + date.getSeconds()).slice(-2);
    return dateString;
  },

  'ConvertDepthToRGBUsingHistogram': function(depthImage, nearColor, farColor, rgbImage) {
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
  },

  'getSP': function() {
    var realsense = window.realsense;
    if (!(realsense &&
          realsense instanceof Object &&
          realsense.hasOwnProperty('ScenePerception') &&
          realsense.ScenePerception instanceof Object)) {
      console.error('Invalid realsense.ScenePerception interface.');
      return null;
    }
    return realsense.ScenePerception;
  },

  'Status': function(defaultDuration) {
    var myStatusDom = document.createElement('paper-toast');
    var myDuration = (defaultDuration == undefined) ? 3000 : defaultDuration;
    function updateStatus(msg, level, duration) {
      var colorArray = ['green', 'red', 'orange'];
      var myLevel = 0;
      var dur = duration == undefined ? myDuration : duration;
      if (level == 1 || level == 2) myLevel = level;

      myStatusDom.style.color = colorArray[myLevel];
      myStatusDom.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      myStatusDom.show({text: msg, duration: dur});
    }

    // level: 0(info, green), 1(error, red), 2(warning, orange)
    this.info = function(msg, duration) {updateStatus(msg, 0, duration)};
    this.error = function(msg, duration) {updateStatus(msg, 1, duration)};
    this.warning = function(msg, duration) {updateStatus(msg, 2, duration)};
    this.getDom = function() {return myStatusDom};
  }
};
