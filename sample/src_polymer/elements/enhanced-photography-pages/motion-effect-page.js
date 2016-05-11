var motionEffectPageReady = (function() {

  // Init values
  var right = 0.0, up = 0.0, forward = 0.0,
      zoom = 0.0, yaw = 0.0, pitch = 0.0, roll = 0.0;

  function initPage(dom) {
    // Connect sliders to values.
    var leftRightSlider = dom.$.leftRightSlider;
        upDownSlider = dom.$.upDownSlider;
        forwardBackSlider = dom.$.forwardBackSlider;
        zoomSlider = dom.$.zoomSlider;
        yawSlider = dom.$.yawSlider;
        pitchSlider = dom.$.pitchSlider;
        roolSlider = dom.$.roolSlider;

    leftRightSlider.addEventListener('value-change', function() {
      right = parseInt(leftRightSlider.value) * 0.01;
      console.log(right);
    });

    upDownSlider.addEventListener('value-change', function() {
      up = parseInt(upDownSlider.value) * 0.01;
      console.log(up);
    });

    forwardBackSlider.addEventListener('value-change', function() {
      forward = parseInt(forwardBackSlider.value) * 0.01;
      console.log(forward);
    });

    zoomSlider.addEventListener('value-change', function() {
      zoom = parseInt(zoomSlider.value) * 0.2 * 0.2;
      console.log(zoom);
    });

    yawSlider.addEventListener('value-change', function() {
      yaw = parseInt(yawSlider.value) * 0.2;
      console.log(yaw);
    });

    pitchSlider.addEventListener('value-change', function() {
      pitch = parseInt(pitchSlider.value) * 0.2;
      console.log(pitch);
    });

    roolSlider.addEventListener('value-change', function() {
      rool = parseInt(roolSlider.value) * 0.2;
      console.log(rool);
    });
  }

  return initPage;
})();
