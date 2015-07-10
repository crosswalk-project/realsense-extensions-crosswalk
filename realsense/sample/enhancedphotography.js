var statusElement = document.getElementById('status');
var startButton = document.getElementById('start');
var stopButton = document.getElementById('stop');
var snapShotButton = document.getElementById('snapshot');
var loadButton = document.getElementById('load');
var saveButton = document.getElementById('save');
var measureButton = document.getElementById('measure');

var preview_canvas = document.getElementById('preview');
var image_canvas = document.getElementById('image');

var preview_context, preview_data, image_context, image_data;
var ep;

function main() {
  ep = new realsense.EnhancedPhotography();

  preview_context = preview_canvas.getContext('2d');
  image_context = image_canvas.getContext('2d');
  preview_data = preview_context.createImageData(320, 240);
  image_data = image_context.createImageData(320, 240);

  var image_fps = new Stats();
  image_fps.domElement.style.position = 'absolute';
  image_fps.domElement.style.top = '0px';
  image_fps.domElement.style.right = '0px';
  document.getElementById('canvas_container').appendChild(image_fps.domElement);

  var getting_image = false;
  ep.onimage = function(e) {
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

  measureButton.onclick = function(e) {
    statusElement.innerHTML = 'Status Info : Measure: ';
    // TODO(qjia7): Allow user to select two points on image.
    var point1 = { x: 20, y: 25 };
    var point2 = { x: 30, y: 35 };
    ep.measureDistance(point1, point2).then(
        function(d) {
          statusElement.innerHTML += 'distance = ' +
              parseFloat(d.distance).toFixed(2) + ' millimeters';
        },
        function(e) { statusElement.innerHTML += e; });
  };
}
