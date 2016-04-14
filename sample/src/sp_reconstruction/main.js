const MIN_ACCEPTABLE_QUALITY = 0.25;
const SP_SIZE_WIDTH = 320;
const SP_SIZE_HEIGHT = 240;
const SP_SIZE_FPS = 60;
const CONTROL_PANEL_WIDTH = 36;
// Panel margin: margin_left + right_position
const CONTROL_PANEL_MARGIN = 8 + 10;

// Global variables.
var sp;
var imagePanelWidth = SP_SIZE_WIDTH;
var imagePanelHeight = SP_SIZE_HEIGHT;

// SP status:
// 'idle'(0) - before init successfully,
// 'checking'(1) - init successfully,
// 'tracking'(2) - SP started
var spStatus = 0;
var buttons = [
  {
    'id': 'playOrStop',
    'display': 'play',
    'details': '(p)lay/pause',
  },
  {
    'id': 'toggleImageRender',
    'display': 'i',
    'details': 'cycle (i)mage color/depth',
  },
  {
    'id': 'toggleExtend',
    'display': 'e',
    'details': '(e)xtend reconstruction',
    'showValue': true
  },
  {
    'id': 'toggleMeshRender',
    'display': 'm',
    'details': '(m)eshing',
    'showValue': true
  },
  {
    'id': 'reset',
    'display': 'r',
    'details': '(r)eset SP',
  },
  {
    'id': 'centerViewpoint',
    'display': 'c',
    'details': '(c)enter/reset viewpoint',
  },
  {
    'id': 'staticViewpoint',
    'display': 'v',
    'details': 'static (v)iewpoint',
  },
  {
    'id': 'saveMesh',
    'display': 's',
    'details': '(s)ave mesh',
  },
  {
    'id': 'exit',
    'display': 'X',
    'details': 'destroy and e(x)it',
  }
];

function createButtons() {
  var controlPanel = document.getElementById('controlPanel');
  var i, b, bInfo;
  var instructions = '';
  for (i = 0; i < buttons.length; i++) {
    bInfo = buttons[i];
    b = document.createElement('button');
    b.innerText = bInfo.display;
    b.id = bInfo.id;
    if (bInfo.id == 'playOrStop') {
      b.style.fontSize = 12;
      b.style.marginBottom = 10;
      b.disabled = true;
    }
    if (bInfo.id == 'exit') {
      b.style.marginTop = 10;
    }
    controlPanel.appendChild(b);

    instructions += bInfo.details;

    if (bInfo.showValue) {
      instructions += ' = <code id=' + getButtonValueId(bInfo.id) + '></code>';
    }
    if (i != buttons.length - 1) instructions += ', ';
  }
  document.getElementById('instructions').innerHTML = instructions;
}

function getButtonValueId(buttonId) {
  return buttonId + 'Value';
}

function initUI() {
  createButtons();

  // Assign size for each element.
  var controlPanel = document.getElementById('controlPanel');
  controlPanel.style.minWidth = CONTROL_PANEL_WIDTH;
  controlPanel.style.minHeight = SP_SIZE_HEIGHT;

  // Adjust the size for elements.
  resizeUI();
}

function resizeUI() {
  var container = document.getElementById('container');
  var width = container.clientWidth;
  var height = container.clientHeight;

  var leftWidth = width - CONTROL_PANEL_WIDTH - CONTROL_PANEL_MARGIN;

  document.getElementById('renderContainer').style.width = leftWidth;
  document.getElementById('bottomPanel').style.width = leftWidth;

  imagePanelWidth = leftWidth / 2;
  var ratio = SP_SIZE_WIDTH / SP_SIZE_HEIGHT;
  imagePanelHeight = imagePanelWidth / ratio;
}

// level: 0(info, green), 1(error, red), 2(warning, orange)
function updateStatus(msg, level) {
  var status = document.getElementById('status');
  var colorArray = ['green', 'red', 'orange'];
  var myLevel = 0;
  if (level == 1 || level == 2) myLevel = level;

  status.innerText = msg;
  status.style.color = colorArray[myLevel];
}

var Status = {
  info: function(msg) {updateStatus(msg)},
  error: function(msg) {updateStatus(msg, 1)},
  warning: function(msg) {updateStatus(msg, 2)},
};

function destroySP() {
  sp.destroy().then(function() {
    spStatus = 0;
    Status.info('destroy succeeds');
  }, errorHandler);
}

function errorHandler(eMsg) {
  if (!eMsg) return;

  if (eMsg instanceof Object) eMsg = eMsg.message;

  if (eMsg instanceof String || typeof eMsg == 'string') {
    Status.error(eMsg);
  }
}

function initSP(cbk) {
  var initConfig = {
    useOpenCVCoordinateSystem: true,
    colorCaptureSize: {width: SP_SIZE_WIDTH, height: SP_SIZE_HEIGHT},
    depthCaptureSize: {width: SP_SIZE_WIDTH, height: SP_SIZE_HEIGHT},
    captureFramerate: SP_SIZE_FPS
  };
  sp.init(initConfig).then(function() {
    spStatus = 1;
    cbk();
    Status.info('init succeeds');
  }, errorHandler);
}

//window.onclose = destroySP;
window.onbeforeunload = destroySP;

function displayText(quality, accuracy) {
  var rightHint = document.getElementById('rightHint');
  var leftHint = document.getElementById('leftHint');
  rightHint.innerHTML = '';
  leftHint.innerHTML = '';

  if (spStatus == 1) {
    var playButton = document.getElementById('playOrStop');
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

  if (spStatus == 2) {
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
    status.error(e.status);
  };

  ////////////// Click Handlers for Buttons /////////////
  document.getElementById('playOrStop').onclick = function(e) {
    if (spStatus == 1) {
      sp.start().then(function() {
        spStatus = 2;
        e.target.innerText = 'stop';
        Status.info('SP started successfully');
      }, errorHandler);
    } else if (spStatus == 2) {
      sp.stop().then(function() {
        spStatus = 1;
        e.target.innerText = 'play';
        Status.info('SP stops working');
      }, errorHandler);
    } else {
      e.target.disabled = true;
      var error = 'Bad SP status, ';
      if (spStatus == 0) error += 'SP init maybe failed, ';

      Status.error(error + 'Please stop DCM service and run this sample again.');
    }
  };

  document.getElementById('toggleImageRender').onclick = leftView.toggleView;

  document.getElementById('toggleExtend').onclick = rightView.toggleExtend;

  document.getElementById('toggleMeshRender').onclick = rightView.toggleView;

  document.getElementById('reset').onclick = function(e) {
    sp.reset().then(function() {
      Status.info('reset succeeds');
    }, errorHandler);

    rightView.reset();
  };

  document.getElementById('centerViewpoint').onclick = function(e) {
    if (spStatus > 0) rightView.centerViewpoint();
  };

  document.getElementById('staticViewpoint').onclick = function(e) {
    if (spStatus > 0) rightView.staticViewpoint();
  };

  document.getElementById('saveMesh').onclick = function(e) {
    if (spStatus <= 0) {
      Status.error('Wrong state, init and start SP first.');
      return;
    }
    sp.saveMesh().then(function(blob) {
      xwalk.experimental.native_file_system.requestNativeFileSystem('documents', function(fs) {
        var fileName = '/documents/savedMesh_' + RSUtils.getDateString() + '.obj';
        fs.root.getFile(fileName, { create: true }, function(entry) {
          entry.createWriter(function(writer) {
            writer.onwriteend = function(e) {
              Status.info('Saved Mesh:' + fileName);
            };
            writer.onerror = function(e) {
              Status.error('Saved Mesh:save failed, error' + e.toString());
            };
            writer.write(blob);
          }, errorHandler);
        }, errorHandler);
      });
    }, errorHandler);
  };

  document.getElementById('exit').onclick = function() {
    window.close();
  };

  window.onresize = function() {
    resizeUI();
    leftView.resize(imagePanelWidth, imagePanelHeight);
    rightView.resize(imagePanelWidth, imagePanelHeight);
  };
}

function main() {
  Status.info('Please wait for initialization.');
  initUI();
  var realsense = window.realsense;
  if (!(realsense &&
        realsense instanceof Object &&
        realsense.hasOwnProperty('ScenePerception') &&
        realsense.ScenePerception instanceof Object)) {
    Status.error('Invalid realsense.ScenePerception interface.');
    return;
  }
  sp = realsense.ScenePerception;

  var leftView = new LeftRender(sp);
  var rightView = new RightRender(sp);
  initSP(function() {
    leftView.init();
    rightView.init();
    leftView.resize(imagePanelWidth, imagePanelHeight);
    rightView.resize(imagePanelWidth, imagePanelHeight);
    bindHandlers(leftView, rightView);
  });
}
