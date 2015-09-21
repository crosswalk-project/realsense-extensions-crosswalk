var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var takePhotoButton = document.getElementById('takePhoto');
var loadButton = document.getElementById('load');
var saveButton = document.getElementById('save');
var depthBlendButton = document.getElementById('depthBlend');

var fileInput = document.getElementById('fileInput');
var fileDisplayArea = document.getElementById('fileDisplayArea');

var yawValueLabel = document.getElementById('yaw_value');
var pitchValueLabel = document.getElementById('pitch_value');
var rollValueLabel = document.getElementById('roll_value');
var zoffsetValueLabel = document.getElementById('zoffset_value');

var preview_canvas = document.getElementById('preview');
var image_canvas = document.getElementById('image');
var overlay_canvas = document.getElementById('overlay');

var ep;
var preview_context, preview_data, image_context, image_data, overlay_context;
var currentPhoto, savePhoto;

var width = 640, height = 480;
var canvas_width = 400, canvas_height = 300;
var x = -1, y = -1;
var yaw = -1, pitch = -1, roll = -1, zoffset = -1;
var has_blend_image = false;
var blend_image, blend_image_data;
var sticker;
var depthValue;
var insert_depth;

var has_image = false;
var is_depth_blend = false;

function outputYawUpdate(value) {
  yawValueLabel.value = value;
  yaw = parseInt(value);
  doDepthBlend();
}

function outputPitchUpdate(value) {
  pitchValueLabel.value = value;
  pitch = parseInt(value);
  doDepthBlend();
}

function outputRollUpdate(value) {
  rollValueLabel.value = value;
  roll = parseInt(value);
  doDepthBlend();
}

function outputZoffetUpdate(value) {
  zoffsetValueLabel.value = value;
  zoffset = parseInt(value);
  doDepthBlend();
}

function doDepthBlend() {
  if (!currentPhoto)
    return;

  if (!has_blend_image)
    return;

  if (!depthValue)
    return;

  insert_depth = depthValue + zoffset;

  ep.depthBlend(currentPhoto, sticker,
                { x: x, y: y },
                insert_depth,
                { pitch: pitch, yaw: yaw, roll: roll },
                1.0).then(
      function(photo) {
        savePhoto = photo;
        photo.queryReferenceImage().then(
            function(image) {
              statusElement.innerHTML = 'Finished blending. Click again!';
              image_data.data.set(image.data);
              image_context.putImageData(image_data, 0, 0);
            },
            function(e) { statusElement.innerHTML = e; });
      },
      function(e) { statusElement.innerHTML = e; });
}

function depthBlend(e) {
  if (!has_image || !has_blend_image)
    return;

  x = parseInt((e.clientX - overlay_canvas.offsetLeft) * width / canvas_width);
  y = parseInt((e.clientY - overlay_canvas.offsetTop) * height / canvas_height);

  overlay_context.clearRect(0, 0, width, height);

  var click_x = x;
  var click_y = y;
  currentPhoto.queryRawDepthImage().then(
    function(depth) {
      currentPhoto.queryOriginalImage().then(
          function(color) {
            click_x *= (depth.width / color.width);
            click_y *= (depth.height / color.height);

            click_x = parseInt(click_x);
            click_y = parseInt(click_y);

            if (click_x >= 0 && click_x < depth.width &&
                click_y >= 0 && click_y < depth.height) {
              depthValue = depth.data[click_y * depth.width + click_x];
            } else {
              return;
            }

            if (depthValue) {
              doDepthBlend();
            } else {
              statusElement.innerHTML =
                  'Insert depth value is 0. Please select another point.';
              return;
            }
          },
          function(e) { statusElement.innerHTML = e; });
    },
    function(e) { statusElement.innerHTML = e; });
}

function main() {
  fileInput.addEventListener('change', function(e) {
    var file = fileInput.files[0];
    var imageType = /image.*/;

    if (file.type.match(imageType)) {
      var reader = new FileReader();

      reader.onload = function(e) {
        fileDisplayArea.src = reader.result;

        blend_image = new Image();
        blend_image.src = reader.result;

        var temp_canvas = document.createElement('canvas');
        var temp_context = temp_canvas.getContext('2d');
        temp_context.drawImage(blend_image, 0, 0);
        blend_image_data = temp_context.getImageData(0, 0, blend_image.width, blend_image.height);

        sticker = {
          format: 'RGB32',
          width: blend_image.width,
          height: blend_image.height,
          data: blend_image_data.data
        };

        has_blend_image = true;
        if (has_image && is_depth_blend)
          statusElement.innerHTML = 'Select a point on photo to Blend';
      };

      reader.readAsDataURL(file);
    } else {
      statusElement.innerHTML = 'File not supported!';
    }
  });

  ep = realsense.EnhancedPhotography;

  preview_context = preview_canvas.getContext('2d');
  image_context = image_canvas.getContext('2d');
  overlay_context = overlay.getContext('2d');
  preview_data = preview_context.createImageData(width, height);

  var getting_image = false;

  overlay_canvas.addEventListener('mousedown', function(e) {
    if (is_depth_blend) {
      depthBlend(e);
    }
  }, false);

  ep.onpreview = function(e) {
    if (getting_image)
      return;
    getting_image = true;
    ep.getPreviewImage().then(
        function(image) {
          preview_data.data.set(image.data);
          preview_context.putImageData(preview_data, 0, 0);
          getting_image = false;
        }, function() { });
  };

  ep.onerror = function(e) {
    statusElement.innerHTML = 'Status Info : onerror: ' + e.status;
  };

  startButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Start: ';
    getting_image = false;
    ep.startPreview().then(function(e) { statusElement.innerHTML += e; },
                           function(e) { statusElement.innerHTML += e; });
  };

  takePhotoButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : TakeSnapshot: ';
    ep.takeSnapShot().then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                image_data =
                    image_context.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                overlay_context.clearRect(0, 0, width, height);
                image_data.data.set(image.data);
                image_context.putImageData(image_data, 0, 0);
                has_image = true;
              },
              function(e) { statusElement.innerHTML += e; });
        },
        function(e) { statusElement.innerHTML += e; });
  };

  saveButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Save as C:/workspace/photo2.jpg ';
    ep.saveAsXMP(savePhoto, 'C:/workspace/photo2.jpg').then(
        function(e) { statusElement.innerHTML += e; },
        function(e) { statusElement.innerHTML += e; });
  };

  loadButton.onclick = function(e) {
    statusElement.innerHTML =
        'Status Info : Load from C:/workspace/photo1.jpg : ';
    ep.loadFromXMP('C:/workspace/photo1.jpg').then(
        function(photo) {
          currentPhoto = photo;
          savePhoto = photo;
          currentPhoto.queryReferenceImage().then(
              function(image) {
                image_context.clearRect(0, 0, width, height);
                image_data =
                    image_context.createImageData(image.width, image.height);
                statusElement.innerHTML += 'Sucess';
                overlay_context.clearRect(0, 0, width, height);
                image_data.data.set(image.data);
                image_context.putImageData(image_data, 0, 0);
                has_image = true;
              },
              function(e) { statusElement.innerHTML += e; });
        },
        function(e) { statusElement.innerHTML += e; });
  };

  stopButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Stop: ';
    ep.stopPreview().then(function(e) { statusElement.innerHTML += e; },
                          function(e) { statusElement.innerHTML += e; });
  };

  depthBlendButton.onclick = function(e) {
    if (!has_image) {
      statusElement.innerHTML = 'There is no image to process';
      return;
    }

    is_depth_blend = true;

    if (!has_blend_image) {
      statusElement.innerHTML = 'Load an image to blend';
      return;
    }
    currentPhoto.queryReferenceImage().then(
        function(image) {
          image_context.clearRect(0, 0, width, height);
          image_data = image_context.createImageData(image.width, image.height);
          overlay_context.clearRect(0, 0, width, height);
          image_data.data.set(image.data);
          image_context.putImageData(image_data, 0, 0);
        },
        function(e) { statusElement.innerHTML += e; });
    statusElement.innerHTML = 'Select a point on photo to Blend';
  };
}
