var motionEffectPageReady = (function() {

  // Effection values.
  var right = 0.0, up = 0.0, forward = 0.0,
      zoom = 0.0, yaw = 0.0, pitch = 0.0, roll = 0.0;

  // DOM elements.
  var loadPhoto, imageCanvas, toast;

  // RealSense objects.
  var motionEffect, photoUtils, XDMUtils;

  // Canvas objects.
  var imageContext, imageData;

  // flags.
  var hasImage = false;
      isInitialized = false;

  // To show information or error messages.
  function toastMessage(message) {
    toast.text = message;
    toast.open();
  }

  // Reflect the effect values.
  function doMothionEffect() {
    if (!hasImage || !isInitialized || !motionEffect)
      return;

    motionEffect.apply({ horizontal: right, vertical: up, distance: forward },
                       { pitch: pitch, yaw: yaw, roll: roll },
                       zoom).then(
        function(image) {
          toastMessage('Finished MotionEffects');
          imageData.data.set(image.data);
          imageContext.putImageData(imageData, 0, 0);
        },
        function(e) { toastMessage(e.message); });
  }

  // To initlize the effection sliders.
  function initSliders(dom) {
    var leftRightSlider = dom.$.leftRightSlider;
        upDownSlider = dom.$.upDownSlider;
        forwardBackSlider = dom.$.forwardBackSlider;
        zoomSlider = dom.$.zoomSlider;
        yawSlider = dom.$.yawSlider;
        pitchSlider = dom.$.pitchSlider;
        roolSlider = dom.$.roolSlider;

    leftRightSlider.addEventListener('value-change', function() {
      right = parseInt(leftRightSlider.value) * 0.01;
      doMothionEffect();
    });

    upDownSlider.addEventListener('value-change', function() {
      up = parseInt(upDownSlider.value) * 0.01;
      doMothionEffect();
    });

    forwardBackSlider.addEventListener('value-change', function() {
      forward = parseInt(forwardBackSlider.value) * 0.01;
      doMothionEffect();
    });

    zoomSlider.addEventListener('value-change', function() {
      zoom = parseInt(zoomSlider.value) * 0.2 * 0.2;
      doMothionEffect();
    });

    yawSlider.addEventListener('value-change', function() {
      yaw = parseInt(yawSlider.value) * 0.2;
      doMothionEffect();
    });

    pitchSlider.addEventListener('value-change', function() {
      pitch = parseInt(pitchSlider.value) * 0.2;
      doMothionEffect();
    });

    roolSlider.addEventListener('value-change', function() {
      rool = parseInt(roolSlider.value) * 0.2;
      doMothionEffect();
    });
  }

  // To initlize the canvas and RealSense objects.
  function initMainPanel(dom) {
    photoUtils = realsense.DepthEnabledPhotography.PhotoUtils;
    XDMUtils = realsense.DepthEnabledPhotography.XDMUtils;

    imageCanvas = dom.$.image;
    toast = dom.$.toast;
    imageContext = imageCanvas.getContext('2d');

    var loadPhoto = dom.$.loadPhoto.inputElement;
    loadPhoto.addEventListener('change', function(e) {
      var file = loadPhoto.files[0];
      XDMUtils.isXDM(file).then(
          function(success) {
            if (success) {
              XDMUtils.loadXDM(file).then(
                  function(photo) {
                    photo.queryContainerImage().then(
                        function(image) {
                          imageCanvas.width = image.width;
                          imageCanvas.height = image.height;
                          imageData = imageContext.createImageData(image.width, image.height);
                          toastMessage('Load successfully.');
                          imageData.data.set(image.data);
                          imageContext.putImageData(imageData, 0, 0);
                          hasImage = true;

                          photoUtils.getDepthQuality(photo).then(
                              function(quality) {
                                toastMessage('The photo quality is ' + quality);

                                if (!motionEffect) {
                                  try {
                                    motionEffect =
                                        new realsense.DepthEnabledPhotography.MotionEffect();
                                  } catch (e) {
                                    toastMessage(e.message);
                                    return;
                                  }
                                }
                                motionEffect.init(photo).then(
                                    function() {
                                      isInitialized = true;
                                      doMothionEffect();
                                    },
                                    function(e) {
                                      toastMessage('The photo quality is ' +
                                                    quality + '. ' + e.message);
                                    });
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
    });
  }

  function initPage(dom) {
    initSliders(dom);
    initMainPanel(dom);
  }

  return initPage;
})();
