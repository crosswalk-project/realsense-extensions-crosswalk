var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var snapShotButton = document.getElementById('snapshot');
var loadButton = document.getElementById('load');
var saveButton = document.getElementById('save');
var measureRadio = document.getElementById('measure');

var preview_canvas = document.getElementById('preview');
var image_canvas = document.getElementById('image');
var overlay_canvas = document.getElementById('overlay');

var preview_context, preview_data, image_context, image_data;
var overlay_context;
var ep;

var width = 320, height = 240;

var click_count = 0;
var start_x = 0;
var start_y = 0;
var has_image = false;
function measureDistance(e) {
  function drawCross(x, y) {
    overlay_context.beginPath();
    overlay_context.strokeStyle = 'blue';
    overlay_context.lineWidth = 2;
    overlay_context.moveTo(x - 7, y - 7);
    overlay_context.lineTo(x + 7, y + 7);
    overlay_context.stroke();
    overlay_context.moveTo(x + 7, y - 7);
    overlay_context.lineTo(x - 7, y + 7);
    overlay_context.stroke();
    overlay_context.closePath();
  };
  if (has_image == false)
    return;
  click_count = click_count + 1;
  var x = e.clientX - overlay_canvas.offsetLeft;
  var y = e.clientY - overlay_canvas.offsetTop;
  if (click_count % 2 == 0) {
    drawCross(x, y);
    overlay_context.beginPath();
    overlay_context.moveTo(start_x, start_y);
    overlay_context.lineTo(x, y);
    overlay_context.strokeStyle = 'blue';
    overlay_context.lineWidth = 2;
    overlay_context.stroke();
    overlay_context.closePath();
    statusElement.innerHTML = 'Status Info : Measure: ';
    ep.measureDistance({x: start_x, y: start_y}, {x: x, y: y}).then(
        function(d) {
          statusElement.innerHTML += 'distance = ' +
              parseFloat(d.distance).toFixed(2) + ' millimeters';
          overlay_context.fillStyle = 'blue';
          overlay_context.font = 'bold 14px Arial';
          overlay_context.fillText(
              parseFloat(d.distance).toFixed(2) + ' mm',
              (start_x + x) / 2, (start_y + y) / 2 - 5);
        },
        function(e) { statusElement.innerHTML += e; });
  } else {
    overlay_context.clearRect(0, 0, width, height);
    drawCross(x, y);
    start_x = x;
    start_y = y;
  }
}

function main() {
  ep = new realsense.EnhancedPhotography();

  preview_context = preview_canvas.getContext('2d');
  image_context = image_canvas.getContext('2d');
  overlay_context = overlay.getContext('2d');

  measureRadio.addEventListener('click', function(e) {
    if (measureRadio.checked) {
      statusElement.innerHTML = 'Select two points to measure distance.';
    }
  }, false);

  overlay_canvas.addEventListener('mousedown', function (e) {
    if (measureRadio.checked) {
      measureDistance(e);
    }
  }, false);

  preview_data = preview_context.createImageData(width, height);
  image_data = image_context.createImageData(width, height);

  var image_fps = new Stats();
  image_fps.domElement.style.position = 'absolute';
  image_fps.domElement.style.top = '0px';
  image_fps.domElement.style.right = '0px';
  document.getElementById('canvas_container').appendChild(image_fps.domElement);

  var getting_image = false;
  ep.onimage = function(e) {
    overlay_context.clearRect(0, 0, width, height);
    has_image = true;
    image_data.data.set(e.data.data);
    image_context.putImageData(image_data, 0, 0);
  };

  ep.onpreview = function(e) {
    if (getting_image)
      return;
    getting_image = true;
    ep.getPreviewImage().then(
        function(image) {
          preview_data.data.set(image.data);
          preview_context.putImageData(preview_data, 0, 0);
          image_fps.update();
          getting_image = false;
        }, function() {});
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

  snapShotButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : TakeSnapshot: ';
    ep.takeSnapShot().then(
        function(e) { statusElement.innerHTML += e; },
        function(e) { statusElement.innerHTML += e; });
  };

  saveButton.onclick = function(e) {
    // TODO(qjia7): Allow user to config the file path.
    statusElement.innerHTML = 'Status Info : Save as C:/workspace/photo2.jpg ';
    ep.saveAsXMP('C:/workspace/photo2.jpg').then(
        function(e) { statusElement.innerHTML += e; },
        function(e) { statusElement.innerHTML += e; });
  };

  loadButton.onclick = function(e) {
    // TODO(qjia7): Allow user to config the file path.
    statusElement.innerHTML =
        'Status Info : Load from C:/workspace/photo1.jpg : ';
    ep.loadFromXMP('C:/workspace/photo1.jpg').then(
        function(e) { statusElement.innerHTML += e; },
        function(e) { statusElement.innerHTML += e; });
  };

  stopButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Stop: ';
    ep.stopPreview().then(function(e) { statusElement.innerHTML += e; },
                          function(e) { statusElement.innerHTML += e; });
  };
}
