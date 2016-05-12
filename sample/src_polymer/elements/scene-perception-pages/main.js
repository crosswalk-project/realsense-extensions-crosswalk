const MIN_ACCEPTABLE_QUALITY = 0.25;
const SP_SIZE_WIDTH = 320;
const SP_SIZE_HEIGHT = 240;
const SP_SIZE_FPS = 60;
const CONTROL_PANEL_WIDTH = 125;
var myStatus = new Status();

function destroySP(spDom) {
  var sp = getSP();
  if (!sp || spDom.spState <= 0) {
    spDom.fire('clear');
    return;
  }

  sp.destroy().then(function() {
    spDom.spState = 0;
    myStatus.info('destroy succeeds');
    spDom.fire('clear');
  }, function(e) {
    spDom.fire('clear');
  });
}

function main(spDom) {
  var sp = getSP();
  if (!sp) return;

  if (spDom.spState < 0) {
    spDom.$$('#bottomPanel').appendChild(myStatus.getDom());

    var leftView = new LeftRender(sp, spDom);
    var rightView = new RightRender(sp, spDom);
    bindHandlers(leftView, rightView);
  }

  myStatus.info('Please wait for initialization.');
  initSP(function() {
    if (spDom.spState < 0) {
      leftView.init();
      rightView.init();
    }
    resizeUI(rightView);
  });

  /*--------------------------Sub functions ---------------------------*/
  function initSP(cbk) {
    if (spDom.spState > 0) {
      errorHandler('Wrong state to init SP.');
      return;
    }

    var initConfig = {
      useOpenCVCoordinateSystem: true,
      colorCaptureSize: {width: SP_SIZE_WIDTH, height: SP_SIZE_HEIGHT},
      depthCaptureSize: {width: SP_SIZE_WIDTH, height: SP_SIZE_HEIGHT},
      captureFramerate: SP_SIZE_FPS
    };
    sp.init(initConfig).then(function() {
      if (cbk instanceof Function) cbk();

      // SP status:
      // 'idle'(0) - before init successfully,
      // 'checking'(1) - init successfully,
      // 'tracking'(2) - SP started
      spDom.spState = 1;
      spDom.extendReconstruction = true;
      myStatus.info('init succeeds');
    }, function(e) {
      spDom.spState = 0;
      errorHandler(e);
    });
  }

  function displayText(quality, accuracy) {
    var leftHint = spDom.$$('#leftHint');
    var rightHint = spDom.$$('#rightHint');
    rightHint.innerText = '';
    leftHint.innerText = '';

    if (spDom.spState == 1) {
      var playButton = spDom.$$('#playOrPause');
      playButton.disabled = true;

      rightHint.innerText = 'Scene Quality = ' + quality;
      if (quality >= MIN_ACCEPTABLE_QUALITY) {
        playButton.disabled = false;
        leftHint.innerText = 'Press the play button.';
        leftHint.style.color = 'green';
      }else if (quality == -2) {
        leftHint.innerText = 'Point to an area within [1m, 2m] to start.';
        leftHint.style.color = 'red';
      } else if ((quality > 0 && quality < MIN_ACCEPTABLE_QUALITY) || quality == -1) {
        leftHint.innerText = 'Point to an area with more structure (few planar surfaces) to start.';
        leftHint.style.color = 'red';
      }
    }

    if (spDom.spState == 2) {
      var str = 'Tracking Accuracy = ' + accuracy;
      var moreStr = '';

      if (accuracy == 'med' || accuracy == 'low') {
        if (quality > 0 || quality == -1) {
          moreStr =
              'Point to a previously seen area with more structure\n' +
              'to recover high accuracy tracking';
        } else if (quality == -2) {
          moreStr =
              'Point to a previously seen area within [1m, 2m]\n' +
              'to recover high accuracy tracking.';
        }
      } else if (accuracy == 'failed') {
        str += ' - Relocalizing...';
        moreStr = 'Point to a previously seen area to recover tracking.';
      }
      rightHint.innerHTML = str + '<br/>' + moreStr;
      rightHint.style.color = (accuracy == 'high') ? 'green' : 'red';
    }
  }

  function bindHandlers(leftView, rightView) {
    sp.onchecking = function(e) {
      var quality = e.data.quality;
      displayText(quality.toFixed(2));
      leftView.updateView();
    };

    sp.onsampleprocessed = function(e) {
      var quality = e.data.quality;
      displayText(e.data.quality.toFixed(2), e.data.accuracy);

      leftView.updateView();
      rightView.updateView(e.data.cameraPose);
    };

    sp.onmeshupdated = rightView.updateMeshes;

    sp.onerror = function(e) {
      myStatus.error(e.status);
    };

    ////////////// Click Handlers for Buttons /////////////
    spDom.$$('#playOrPause').addEventListener('tap', function(e) {
      if (spDom.spState === 1) {
        sp.start().then(function() {
          spDom.spState = 2;
          myStatus.info('SP started successfully');
        }, errorHandler);
      } else if (spDom.spState === 2) {
        sp.stop().then(function() {
          spDom.spState = 1;
          myStatus.info('SP stops working');
        }, errorHandler);
      } else {
        e.target.disabled = true;
        var error = 'Bad SP status, ';
        if (spDom.spState === 0) error += 'SP init maybe failed, ';

        myStatus.error(error + 'Please stop DCM service and run this sample again.');
      }
    });

    spDom.$$('#colorOrDepth').addEventListener('tap', function(ev) {
      var viewIndex = ev.currentTarget.checked ? 0 : 1;
      leftView.toggleView(viewIndex);
    });

    spDom.$$('#meshOrVolume').addEventListener('tap', function(ev) {
      var viewIndex = ev.currentTarget.checked ? 0 : 1;
      rightView.toggleView(viewIndex);
    });

    spDom.$$('#reset').addEventListener('tap', function(ev) {
      sp.reset().then(function() {
        myStatus.info('reset succeeds');
        spDom.extendReconstruction = true;
      }, errorHandler);

      rightView.reset();
    });

    spDom.$$('#centerViewpoint').addEventListener('tap', function(ev) {
      if (spDom.spState > 0) rightView.centerViewpoint();
    });

    spDom.$$('#staticViewpoint').addEventListener('tap', function(ev) {
      if (spDom.spState > 0) rightView.staticViewpoint();
    });
    spDom.$$('#saveMesh').addEventListener('tap', function(ev) {
      if (spDom.spState <= 0) {
        myStatus.error('Wrong state, init and start SP first.');
        return;
      }
      sp.saveMesh().then(function(blob) {
        xwalk.experimental.native_file_system.requestNativeFileSystem('documents', function(fs) {
          var fileName = '/documents/savedMesh_' + RSUtils.getDateString() + '.obj';
          fs.root.getFile(fileName, { create: true }, function(entry) {
            entry.createWriter(function(writer) {
              writer.onwriteend = function(e) {
                myStatus.info('Saved Mesh:' + fileName);
              };
              writer.onerror = function(e) {
                myStatus.error('Saved Mesh:save failed, error' + e.toString());
              };
              writer.write(blob);
            }, errorHandler);
          }, errorHandler);
        });
      }, errorHandler);
    });

    spDom.$$('#zoomIn').addEventListener('tap', rightView.zoomIn);

    spDom.$$('#zoomOut').addEventListener('tap', rightView.zoomOut);

    window.onresize = function() {
      resizeUI(rightView);
      Polymer.dom.flush();
    };
    window.onclose = function(spDom) { destroySP(spDom); };
    window.onbeforeunload = function(spDom) { destroySP(spDom); };
  }

  function resizeUI(rightView) {
    Polymer.dom.flush();
    var container = spDom.$$('#container');
    var width = container.offsetWidth;
    var height = container.offsetHeight;
    if (!width && !height) return;

    var leftWidth = width - CONTROL_PANEL_WIDTH;

    spDom.$$('#rightContainer').style.width = leftWidth;
    var bottomPanel = spDom.$$('#bottomPanel');
    bottomPanel.style.bottom = '10px';
    bottomPanel.style.width = leftWidth;

    var ratio = SP_SIZE_WIDTH / SP_SIZE_HEIGHT;
    //imagePanelWidth = leftWidth;
    var imagePanelWidth = Math.min(leftWidth, height * ratio);
    var imagePanelHeight = imagePanelWidth / ratio;

    spDom.$$('#rightContainer').style.width = leftWidth;

    if (rightView) {
      rightView.resize(imagePanelWidth, imagePanelHeight);
    }
  }

}

function getButtonValueId(buttonId) {
  return buttonId + 'Value';
}

function errorHandler(eMsg) {
  if (!eMsg) return;

  if (eMsg instanceof Object) eMsg = eMsg.message;

  if (eMsg instanceof String || typeof eMsg == 'string') {
    myStatus.error(eMsg);
  }
}

function Status(statusDom) {
  var myStatusDom = document.createElement('span');
  function updateStatus(msg, level) {
    var colorArray = ['green', 'red', 'orange'];
    var myLevel = 0;
    if (level == 1 || level == 2) myLevel = level;

    myStatusDom.innerText = msg;
    myStatusDom.style.color = colorArray[myLevel];
  }

  // level: 0(info, green), 1(error, red), 2(warning, orange)
  this.info = function(msg) {updateStatus(msg)};
  this.error = function(msg) {updateStatus(msg, 1)};
  this.warning = function(msg) {updateStatus(msg, 2)};
  this.getDom = function() {return myStatusDom};
}

function getSP() {
  var realsense = window.realsense;
  if (!(realsense &&
        realsense instanceof Object &&
        realsense.hasOwnProperty('ScenePerception') &&
        realsense.ScenePerception instanceof Object)) {
    myStatus.error('Invalid realsense.ScenePerception interface.');
    return null;
  }
  return realsense.ScenePerception;
}
