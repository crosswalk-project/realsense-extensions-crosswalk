(function() {
  const MIN_ACCEPTABLE_QUALITY = 0.25;
  const SP_SIZE_WIDTH = 320;
  const SP_SIZE_HEIGHT = 240;
  const SP_SIZE_FPS = 60;
  const BOTTOM_PANEL_HEIGHT = 50;
  var myStatus = new RSUtils.Status();
  var sp = RSUtils.getSP();
  if (!sp) return;

  function destroySP(arDom) {
    var sp = RSUtils.getSP();
    if (!sp || arDom.spState <= 0) {
      arDom.fire('clear');
      return;
    }
    sp.destroy().then(function() {
      arDom.spState = 0;
      // Clear the hint.
      arDom.$$('#accuracy').innerText = '';
      myStatus.info('destroy succeeds');
      arDom.fire('clear');
    }, function(e) {
      myStatus.error('Failed to destroy SP, nor release the camera.');
      arDom.fire('clear');
    });
  }

  function main(arDom) {
    if (arDom.spState < 0) {
      var renderContainer = arDom.$$('#renderContainer');
      renderContainer.appendChild(myStatus.getDom());
      myStatus.getDom().fitInto = renderContainer;

      var renderView = new RenderView(sp);

      bindHandlers(renderView);
    }

    myStatus.info('Please wait for initialization.');
    initSP(function() {
      if (arDom.spState < 0) {
        renderView.init();
      }
      resizeUI(renderView);
    });

    /*--------------------------Sub functions ---------------------------*/
    function initSP(cbk) {
      if (arDom.spState > 0) {
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
        arDom.spState = 1;
        myStatus.info('init succeeds');
      }, function(e) {
        arDom.spState = 0;
        errorHandler(e);
      });
    }

    function displayText(quality, accuracy) {
      var accuracyElement = arDom.$$('#accuracy');
      // Show accuracy and the hint.
      var str = 'Tracking Accuracy:' + accuracy;

      var hintStr = '';
      if (accuracy == 'failed') {
        str += ' - Relocalizing...';
        hintStr = 'Shoot Button is only available when tracking is successful';
      }
      accuracyElement.innerHTML = str;

      if (hintStr.length > 0) {
        accuracyElement.style.color = 'red';
        myStatus.error(hintStr);
      } else {
        accuracyElement.style.color = 'green';
        myStatus.info(hintStr);
      }
    }

    function resizeUI(renderView) {
      var container = arDom.$$('#container');
      var width = container.offsetWidth;
      var height = container.offsetHeight;
      if (width <= 0 || height <= 0) return;

      document.getElementById('bottomPanel').style.width = width;
      document.getElementById('bottomPanel').style.height = BOTTOM_PANEL_HEIGHT;

      renderHeight = height - BOTTOM_PANEL_HEIGHT;

      var renderContainer = document.getElementById('renderContainer');
      renderContainer.style.width = width;
      renderContainer.style.height = renderHeight;

      var render = document.getElementById('renderView');
      var ratio = SP_SIZE_WIDTH / SP_SIZE_HEIGHT;
      var renderWidth = Math.min(width, renderHeight * ratio);

      if (renderView)
        renderView.resize(renderWidth, renderWidth / ratio);
    }

    function bindHandlers(renderView) {
      sp.onchecking = function(e) {
        var quality = e.data.quality;
        if (arDom.spState < 2 && quality >= MIN_ACCEPTABLE_QUALITY) {
          sp.start().then(function() {
            arDom.spState = 2;
          }, errorHandler);
        }
        displayText(quality.toFixed(2), 'failed');
        renderView.updateView(null);
      };

      sp.onsampleprocessed = function(e) {
        var quality = e.data.quality;
        displayText(e.data.quality.toFixed(2), e.data.accuracy);

        renderView.updateView(e.data.cameraPose);
      };

      sp.onerror = function(e) {
        myStatus.error(e.status);
      };

      ////////////// Click Handlers for Buttons /////////////
      arDom.$$('#shoot').addEventListener('tap', function(e) {
        renderView.addObject(e);
      });

      arDom.$$('#reset').addEventListener('tap', function(e) {
        sp.reset().then(function() {
          myStatus.info('reset succeeds');
        }, errorHandler);

        sp.stop().then(function() {
          arDom.spState = 1;
        }, errorHandler);

        renderView.reset();
      });

      window.onresize = function() {
        resizeUI(renderView);
      };
      window.onclose = function(arDom) { destroySP(arDom); };
      window.onbeforeunload = function(arDom) { destroySP(arDom); };
    }
  }

  function errorHandler(eMsg) {
    if (!eMsg) return;

    if (eMsg instanceof Object) eMsg = eMsg.message;

    if (eMsg instanceof String || typeof eMsg == 'string') {
      myStatus.error(eMsg);
    }
  }

  Polymer({
    is: 'augmented-reality-page',
    properties: {
      activated: {
        type: Boolean,
        value: false,
        observer: '_activatedChanged'
      },
      spState: {
        // SP status:
        // 'initial'(-1) - before SP page initialized,
        // 'idle'(0) - before init successfully,
        // 'checking'(1) - init successfully,
        // 'tracking'(2) - SP started
        type: Number,
        value: -1
      }
    },
    _getTrackingState: function(spState) {
      return spState == 2 ? false : true;
    },
    _activatedChanged: function(newValue, oldValue) {
      if (newValue) {
        console.log('SP augmented reality page activated');
        main(this);
      } else {
        destroySP(this);
        console.log('SP augmented reality page deactivated');
      }
    },
  });

  /*--------------------------RederView-----------------------*/
  function RenderView(sp) {
    var canvas = document.getElementById('renderView');
    var webgl;
    var sampleFps = new Stats();
    var sampleFlowController = new CmdFlowController(5);
    var currentPose, currentAccuracy = 'failed';
    var spIntrinsics;

    function init() {
      canvas.width = SP_SIZE_WIDTH;
      canvas.height = SP_SIZE_HEIGHT;
      sampleFps.domElement.style.position = 'absolute';
      sampleFps.domElement.style.top = '0px';
      sampleFps.domElement.style.left = '0px';
      sampleFps.domElement.style.zIndex = '100';
      document.getElementById('renderContainer').insertBefore(sampleFps.domElement, canvas);

      sp.getInternalCameraIntrinsics().then(function(intrinsics) {
        // Compute from GetInternalCameraIntrinsics
        if (intrinsics) {
          spIntrinsics = intrinsics;
          //projectionMatrix = SPMath.configureAugmentedCamera(intrinsics, 0.0, 0.01, 1000.0);
          initData();
        } else {
          errorHandler('Got unavailable camera intrinsics.');
        }
      }, errorHandler);
    }

    function addObject() {
      if (!(spIntrinsics instanceof Object)) {
        errorHandler('Invalid intrinsics');
        return;
      }

      if (verticesImage) {

        var idx = 3 *
            ((verticesImage.width / 2) + (verticesImage.height / 2) * verticesImage.width);

        var x = verticesImage.data[idx + 0];
        var y = verticesImage.data[idx + 1];
        var z = verticesImage.data[idx + 2];

        if (x + y + z !== 0) {
          addBall(x, y, z);
        }
      }
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    var VSHADER_SOURCE =
        'attribute vec4 a_Position;\n' +
        'attribute vec2 a_TexCoord;\n' +
        'varying vec2 v_TexCoord;\n' +
        'void main() {\n' +
        '  gl_Position = a_Position;\n' +
        '  v_TexCoord = a_TexCoord;\n' +
        '}\n';

    // Fragment shader program
    var FSHADER_SOURCE =
        '#ifdef GL_ES\n' +
        'precision mediump float;\n' +
        '#endif\n' +
        'uniform sampler2D u_Sampler;\n' +
        'varying vec2 v_TexCoord;\n' +
        'void main() {\n' +
        '  gl_FragColor = texture2D(u_Sampler, v_TexCoord);\n' +
        '}\n';

    var FSHADER_SOURCE_DEPTH =
        '#extension GL_EXT_frag_depth : enable\n' +
        '#ifdef GL_ES\n' +
        'precision mediump float;\n' +
        '#endif\n' +
        'uniform sampler2D u_Sampler;\n' +
        'varying vec2 v_TexCoord;\n' +
        'varying vec4 v_Color;\n' +
        'void main() {\n' +
        '  vec4 color = texture2D(u_Sampler, v_TexCoord);\n' +
        '  int b = int(color.b * 255.0);\n' +
        '  int a = int(color.a * 255.0);\n' +
        '  int v = (b * 256) + a;\n' +
        '  float dp = float(v) / 65535.0;\n' +
        '  gl_FragDepthEXT = dp ;\n' +
        '  //gl_FragColor = color;\n' +
        '}\n';

    var VSHADER_SOURCE1 =
        'attribute vec3 a_Position;\n' +
        'attribute vec3 a_Normal;\n' +
        'uniform vec3 u_Light;\n' +
        'uniform vec3 u_Color;\n' +
        'uniform mat4 u_ViewMatrix;\n' +
        'uniform mat4 u_ModelMatrix;\n' +
        'uniform mat4 u_ProjMatrix;\n' +
        'varying vec4 v_Color;\n' +
        'varying vec2 v_TexCoord;\n' +
        'void main() {\n' +
        '  gl_Position = u_ProjMatrix * u_ViewMatrix * u_ModelMatrix * vec4(a_Position,1.0);\n' +
        '  v_TexCoord = (gl_Position.xy + 1.0) / 2.0;\n' +
        '  float dd = clamp(dot(a_Normal, u_Light),0.3,1.0);' +
        '  v_Color = vec4(u_Color * dd,1.0);\n' +
        '}\n';

    // Fragment shader program
    var FSHADER_SOURCE1 =
        '#ifdef GL_ES\n' +
        'precision mediump float;\n' +
        '#endif\n' +
        'varying vec4 v_Color;\n' +
        'void main() {\n' +
        '  gl_FragColor = v_Color;\n' +
        '}\n';

    function loadShader(gl, type, source) {
      // Create shader object
      var shader = gl.createShader(type);
      if (shader == null) {
        console.log('unable to create shader');
        return null;
      }

      // Set the shader program
      gl.shaderSource(shader, source);

      // Compile the shader
      gl.compileShader(shader);

      // Check the result of compilation
      var compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (!compiled) {
        var error = gl.getShaderInfoLog(shader);
        console.log('Failed to compile shader: ' + error);
        gl.deleteShader(shader);
        return null;
      }

      return shader;
    }

    function initShaders(gl, vshader, fshader) {
      var program = createProgram(gl, vshader, fshader);
      if (!program) {
        console.log('Failed to create program');
        return false;
      }

      return program;
    }

    function createProgram(gl, vshader, fshader) {
      // Create shader object
      var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
      var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
      if (!vertexShader || !fragmentShader) {
        return null;
      }

      // Create a program object
      var program = gl.createProgram();
      if (!program) {
        return null;
      }

      // Attach the shader objects
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);

      // Link the program object
      gl.linkProgram(program);

      // Check the result of linking
      var linked = gl.getProgramParameter(program, gl.LINK_STATUS);
      if (!linked) {
        var error = gl.getProgramInfoLog(program);
        console.log('Failed to link program: ' + error);
        gl.deleteProgram(program);
        gl.deleteShader(fragmentShader);
        gl.deleteShader(vertexShader);
        return null;
      }
      return program;
    }

    function loadBackgroundVB(gl, vb, program, runderColor) {
      var verticesTexCoords = new Float32Array([
        // Vertex coordinates, texture coordinate
        -1.0, 1.0, 0.0, 1.0,
        -1.0, -1.0, 0.0, 0.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, -1.0, 1.0, 0.0
      ]);

      // Bind the buffer object to target
      gl.bindBuffer(gl.ARRAY_BUFFER, vb);
      gl.bufferData(gl.ARRAY_BUFFER, verticesTexCoords, gl.STATIC_DRAW);

      gl.useProgram(program);

      var FSIZE = verticesTexCoords.BYTES_PER_ELEMENT;
      var a_Position = gl.getAttribLocation(program, 'a_Position');

      gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 4, 0);

      // Enable the assignment of the buffer object
      gl.enableVertexAttribArray(a_Position);

      var a_TexCoord = gl.getAttribLocation(program, 'a_TexCoord');
      gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, FSIZE * 4, FSIZE * 2);
      // Enable the assignment of the buffer object
      gl.enableVertexAttribArray(a_TexCoord);
    }

    function loadTextureAndRender(gl, n, texture, u_Sampler, image) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      /**
       * Must set these flags for Non power-of-two textures
       */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, image.data);
      gl.uniform1i(u_Sampler, 0);
      // Draw the rectangle
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);
    }

    function loadDepthTexture(gl, depthTexture, u_Sampler, image) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, depthTexture);

      /**
       * Must set these flags for Non power-of-two textures
       */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.uniform1i(u_Sampler, 0);
    }

    var bg_vb;
    var bg_u_Sampler;
    var bg_texture;
    var bg_program;

    var depth_program;
    var depth_u_Sampler;

    var ball_vb_po;
    var ball_vb_no;
    var ball_program;
    var ball_u_ModelMatrix;
    var ball_u_ViewMatrix;
    var ball_u_ProjMatrix;

    var ball_position;
    var ball_light;
    var ball_normal;
    var ball_color;

    var ball_cameraPose;

    var ball_frustum; // The projection matrix
    var ball_frustum_transpose;

    var ball_nearClip = 0.01;
    var ball_farClip = 5.0;

    var ball_count;
    var ball_vertexes_position = [];
    var ball_vertexes_normal = [];

    var ballobj_list = [];

    var verticesImage;
    var depthImage;

    var TimeUtils = {
      deltaTime: 0,
      runFrame: function() {
        var time = (new Date()).getTime();
        if (this.currTime) {
          this.deltaTime = (time - this.currTime) / 1000.0;
        }
        this.currTime = time;
      }
    };

    function genBallVertexes(n, po, no, r) {
      var i, j, k;

      function f(a, b) {
        var a = Math.PI * a / n;
        var b = 2 * Math.PI * b / n;
        var l = Math.sin(a);
        return [Math.sin(b) * l, Math.cos(a), Math.cos(b) * l];
      };

      for (i = 1; i <= n; i++) {
        for (j = 1; j <= n; j++) {

          k = [].concat(f(i, j), f(i - 1, j), f(i, j - 1),
                        f(i, j - 1), f(i - 1, j), f(i - 1, j - 1));

          // po: vertices array.
          po.push.apply(po, k);

          // no: normals array.
          no.push.apply(no, k);
        }
      }

      for (i = 0; i < po.length; i++) {
        po[i] = po[i] * r;
      }

      // Retrun the number of vertices.
      return n * n * 6;
    }

    function loadBallVB(gl, vb_po, vb_no, program) {
      gl.useProgram(program);

      gl.bindBuffer(webgl.ARRAY_BUFFER, vb_po);
      gl.bufferData(
          webgl.ARRAY_BUFFER,
          new Float32Array(ball_vertexes_position),
          webgl.STATIC_DRAW);
      gl.vertexAttribPointer(ball_position, 3, webgl.FLOAT, false, 0, 0);

      gl.bindBuffer(webgl.ARRAY_BUFFER, vb_no);
      gl.bufferData(webgl.ARRAY_BUFFER, new Float32Array(ball_vertexes_normal), webgl.STATIC_DRAW);
      gl.vertexAttribPointer(ball_normal, 3, webgl.FLOAT, false, 0, 0);
    }

    function randomValue(start, end) {
      if (start > end) {
        var t = start;
        start = end;
        end = t;
      }

      return start + Math.random() * (end - start);
    }

    function initData() {
      webgl = canvas.getContext('webgl', {antialias: false});

      var available_extensions = webgl.getExtension('EXT_frag_depth');
      if (!available_extensions) {
        // For the feature: 'gl_FragDepthEXT'
        // https://www.khronos.org/registry/gles/extensions/EXT/EXT_frag_depth.txt
        console.error('webgl cannot support EXT_frag_depth');
      }

      bg_program = initShaders(webgl, VSHADER_SOURCE, FSHADER_SOURCE);
      bg_vb = webgl.createBuffer();
      bg_texture = webgl.createTexture();
      bg_u_Sampler = webgl.getUniformLocation(bg_program, 'u_Sampler');

      depth_program = initShaders(webgl, VSHADER_SOURCE, FSHADER_SOURCE_DEPTH);
      depth_u_Sampler = webgl.getUniformLocation(depth_program, 'u_Sampler');

      // create a vertices information (position and normal) for a ball mesh
      ball_count = genBallVertexes(12, ball_vertexes_position, ball_vertexes_normal, 0.04);
      ball_program = initShaders(webgl, VSHADER_SOURCE1, FSHADER_SOURCE1);

      ball_vb_po = webgl.createBuffer();
      ball_vb_no = webgl.createBuffer();

      ball_u_ModelMatrix = webgl.getUniformLocation(ball_program, 'u_ModelMatrix');
      ball_u_ViewMatrix = webgl.getUniformLocation(ball_program, 'u_ViewMatrix');
      ball_u_ProjMatrix = webgl.getUniformLocation(ball_program, 'u_ProjMatrix');
      ball_color = webgl.getUniformLocation(ball_program, 'u_Color');
      ball_light = webgl.getUniformLocation(ball_program, 'u_Light');

      ball_position = webgl.getAttribLocation(ball_program, 'a_Position');
      ball_normal = webgl.getAttribLocation(ball_program, 'a_Normal');

      ball_frustum = SPMath.configureAugmentedCamera(spIntrinsics, 0, ball_nearClip, ball_farClip);
      ball_frustum_transpose = SPMath.mat4ToRowIndexArray(ball_frustum);
    }

    function addBall(x, y, z) {
      ballobj_list.push(createBall(x, y, z));
    }

    function clearBalls() {
      ballobj_list.splice(0, ballobj_list.length);
    }

    function render(sample) {

      if (!webgl) return;

      TimeUtils.runFrame();

      webgl.clearColor(0, 0, 0, 1);
      webgl.clear(webgl.COLOR_BUFFER_BIT | webgl.DEPTH_BUFFER_BIT);
      webgl.disable(webgl.DEPTH_TEST);

      loadBackgroundVB(webgl, bg_vb, bg_program);
      loadTextureAndRender(webgl, 4, bg_texture, bg_u_Sampler, sample.color);

      if (ball_cameraPose) {

        var viewMat = SPMath.mat4FromCameraPose(ball_cameraPose);
        mat4.invert(viewMat, viewMat);

        var rot = mat4.fromValues(
            1.0, 0.0, 0.0, 0.0,
            0.0, -1.0, 0.0, 0.0,
            0.0, 0.0, -1.0, 0.0,
            0.0, 0.0, 0.0, 1.0);
        mat4.mul(viewMat, rot, viewMat);

        webgl.enable(webgl.DEPTH_TEST);

        if (verticesImage) {
          if (!depthImage) {
            depthImage = {};
            depthImage.data = new Uint8Array(verticesImage.width * verticesImage.height * 4);
            depthImage.width = verticesImage.width;
            depthImage.height = verticesImage.height;
          }

          // get raycasted vertices and fill depth from vertices
          var projM = mat4.create();
          mat4.transpose(projM, viewMat);
          mat4.mul(projM, projM, ball_frustum);

          for (var idx = 0; idx < verticesImage.width * verticesImage.height; idx++) {
            var pt = vec4.fromValues(
                verticesImage.data[3 * idx],
                verticesImage.data[3 * idx + 1],
                verticesImage.data[3 * idx + 2],
                1.0);
            var depth = 1.0;

            if (pt[2] >= ball_nearClip && pt[2] <= ball_farClip) {
              pt = SPMath.mat4MultiplyVector4(projM, pt);
              depth = 0.5 * (pt[2] / pt[3] + 1.0);
            }

            // depth [0.0, 1.0]
            // -> depth [0.0, 65535]
            // -> RGBA [0,0,255,255]
            //
            // Then in shader we must convert it back.
            // Please search FSHADER_SOURCE_DEPTH for detail
            //

            depth = Math.floor(depth * 65535);
            var b = (depth >>> 8) & 0x00ff;
            var a = (depth) & 0x00ff;

            var i = idx * 4;
            depthImage.data[i + 0] = 0;
            depthImage.data[i + 1] = 0;
            depthImage.data[i + 2] = b;
            depthImage.data[i + 3] = a;
          }

          // Render a plane to write depth from RGBA texture
          // Don't render the RGA color (gl_FragColor is useless)
          webgl.colorMask(false, false, false, false);
          loadBackgroundVB(webgl, bg_vb, depth_program);
          loadTextureAndRender(webgl, 4, bg_texture, depth_u_Sampler, depthImage);
          webgl.colorMask(true, true, true, true);
        }

        loadBallVB(webgl, ball_vb_po, ball_vb_no, ball_program);

        webgl.uniformMatrix4fv(ball_u_ViewMatrix, false, viewMat);
        webgl.uniformMatrix4fv(ball_u_ProjMatrix, false, ball_frustum_transpose);
        webgl.uniform3fv(ball_light, [-0.707, -0.707, 0.0]);

        for (var i = 0; i < ballobj_list.length; i++) {
          ballobj_list[i].render();
        }
      }
    }

    function math_lerp(start, end, t) {
      return start * (1 - t) + end * t;
    }

    var ball_colors = [
      [1, 0, 0],
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ];

    function createBall(x, y, z) {

      var ball = {};

      ball.x = x;
      ball.y = y;
      ball.z = z;

      x = spIntrinsics.imageSize.width / 2;
      y = spIntrinsics.imageSize.height / 2;

      var pts = vec3.fromValues(
          (x - spIntrinsics.principalPoint.x) * 0.1 / spIntrinsics.focalLength.x,
          (y - spIntrinsics.principalPoint.y) * 0.1 / spIntrinsics.focalLength.y,
          0.1);
      var cameraPoseMat = SPMath.mat4FromCameraPose(ball_cameraPose);
      mat4.transpose(cameraPoseMat, cameraPoseMat);

      ball.s_pts = SPMath.mat4MultiplyVector3(cameraPoseMat, pts);
      ball.color = ball_colors[Math.floor(randomValue(0, ball_colors.length))];

      ball.timer = 0;

      ball.render = function() {
        var modelMatrix = mat4.create();

        var animation_time = 0.25;
        if (this.timer < animation_time) {
          var t = this.timer / animation_time;

          var x = math_lerp(this.s_pts[0], this.x, t);
          var y = math_lerp(this.s_pts[1], this.y, t);
          var z = math_lerp(this.s_pts[2], this.z, t);

          mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(x, y, z));

          this.timer += TimeUtils.deltaTime;
        } else {
          mat4.translate(modelMatrix, modelMatrix, vec3.fromValues(this.x, this.y, this.z));
        }

        // Pass the view and projection matrix to u_ViewMatrix, u_ProjMatrix
        webgl.uniformMatrix4fv(ball_u_ModelMatrix, false, modelMatrix);
        webgl.uniform3fv(ball_color, this.color);

        webgl.drawArrays(webgl.TRIANGLES, 0, ball_count);
      };

      return ball;
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////

    function updateView(cameraPose) {
      if (!sampleFlowController.get())
        return;

      ball_cameraPose = cameraPose;

      // Add a new sphere in the objects array.
      sp.getVertices().then(function(vertics) {
        verticesImage = vertics;
      }, errorHandler);

      sp.getSample().then(function(sample) {

        render(sample);

        // Update the stats.
        sampleFps.update();
        sampleFlowController.release();
      }, errorHandler);
    }

    function resize(width, height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width;
      canvas.style.height = height;
    }

    function reset() {
      currentAccuracy = 'failed';
      clearBalls();
    }

    function CmdFlowController(size) {
      var windowSize = size;
      var avaliableSize = size;
      this.reset = function() {
        avaliableSize = windowSize;
      };
      this.get = function() {
        if (avaliableSize < 1) return false;

        avaliableSize--;
        return true;
      };
      this.release = function() {
        avaliableSize++;
        if (avaliableSize > windowSize)
          avaliableSize = windowSize;
      };
    }

    // Export the elements.
    this.init = init;
    this.updateView = updateView;
    this.addObject = addObject;
    this.resize = resize;
    this.reset = reset;
  }
})();
