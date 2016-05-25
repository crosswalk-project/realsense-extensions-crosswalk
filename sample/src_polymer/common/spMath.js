// This script file should be loaded after gl-matrix.js.
// Because, all the translations are based on this library.
var SPMath = {};

(function(exports) {
  function mat4FromCameraPose(pose) {
    if (!Array.isArray(pose)) return;

    return mat4.fromValues(
        pose[0], pose[4], pose[8], 0,
        pose[1], pose[5], pose[9], 0,
        pose[2], pose[6], pose[10], 0,
        pose[3], pose[7], pose[11], 1);
  };

  function mat4ToCameraPose(sMatrix) {
    var r = mat4ToRowIndexArray(sMatrix);
    // Convert Float32Array to Array;
    var result = [];
    for (var i = 0; i < 12; i++) {
      result.push(r[i]);
    }
    return result;
  };

  function mat4ToRowIndexArray(sMatrix) {
    var rowIndex = mat4.create();
    mat4.transpose(rowIndex, sMatrix);
    return rowIndex;
  };

  function getCleanMat4() {
    return mat4.fromValues(
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0,
        0, 0, 0, 0);
  }

  function mat4MultiplyVector3(m, v) {
    var result = vec3.create();
    result[0] = v[0] * m[0] + v[1] * m[4] + v[2] * m[8] + m[11];
    result[1] = v[0] * m[1] + v[1] * m[5] + v[2] * m[9] + m[12];
    result[2] = v[0] * m[2] + v[1] * m[6] + v[2] * m[10] + m[13];
    return result;
  }

  function mat4MultiplyVector4(m, v) {
    var result = vec4.create();
    result[0] = v[0] * m[0] + v[1] * m[1] + v[2] * m[2] + v[3] * m[3];
    result[1] = v[0] * m[4] + v[1] * m[5] + v[2] * m[6] + v[3] * m[7];
    result[2] = v[0] * m[8] + v[1] * m[9] + v[2] * m[10] + v[3] * m[11];
    result[3] = v[0] * m[12] + v[1] * m[13] + v[2] * m[14] + v[3] * m[15];
    return result;
  }

  /**
   * @param {CameraIntrinsics} intrinsics , internal camera intrinsics of SP
   * @param {Number} skew
   * @param {Number} nearClip
   * @param {Number} farClip
   *
   * @return {THREE.Matrix4} the project matrix, frustum
   */
  function configureAugmentedCamera(intrinsics, skew, nearClip, farClip) {
    var alpha = intrinsics.focalLength.x;
    var beta = intrinsics.focalLength.y;
    var u0 = intrinsics.principalPoint.x;
    var v0 = intrinsics.imageSize.height - intrinsics.principalPoint.y;
    var imgWidth = intrinsics.imageSize.width;
    var imgHeight = intrinsics.imageSize.height;

    var orth = calculateOrthographicProjection(imgWidth, imgHeight, nearClip, farClip);
    var K = setCameraParamsMatrix(alpha, beta, skew, u0, v0, nearClip, farClip);

    var result = mat4.create();
    mat4.multiply(result, K, orth);
    return result;
  }

  /**
   * @param {Number} imgWidth , int
   * @param {Number} imgHeight , int
   * @param {Number} nearClip , float
   * @param {Number} farClip , float
   *
   * @return {THREE.Matrix4}
   */
  function calculateOrthographicProjection(imgWidth, imgHeight, nearClip, farClip) {
    var orth = getCleanMat4();
    orth[0 * 4 + 0] = 2.0 / imgWidth;
    orth[0 * 4 + 3] = -1.0;
    orth[1 * 4 + 1] = 2.0 / imgHeight;
    orth[1 * 4 + 3] = -1.0;
    orth[2 * 4 + 2] = -2.0 / (farClip - nearClip);
    orth[2 * 4 + 3] = -(farClip + nearClip) / (farClip - nearClip);
    orth[3 * 4 + 3] = 1.0;
    return orth;
  }

  function setCameraParamsMatrix(alpha, beta, skew, u0, v0, nearClip, farClip) {
    var K = getCleanMat4();
    K[0 * 4 + 0] = alpha;
    K[0 * 4 + 2] = -u0;
    K[1 * 4 + 1] = beta;
    K[1 * 4 + 2] = -v0;
    K[2 * 4 + 2] = nearClip + farClip;
    K[2 * 4 + 3] = nearClip * farClip;
    K[3 * 4 + 2] = -1.0;
    return K;
  }

  // Init the module.
  if (!glMatrix instanceof Object || !mat4) {
    console.error('No glMatrix found.');
    return;
  }

  // Enable SIMD in glMatrix.
  if (typeof Float32Array !== 'undefined' &&
      typeof SIMD !== 'undefined') {
    glMatrix.ARRAY_TYPE = Float32Array;
    glMatrix.SIMD_AVAILABLE = true;
    glMatrix.ENABLE_SIMD = true;
    glMatrix.USE_SIMD = true;
  }

  // Export the module.
  exports.mat4FromCameraPose = mat4FromCameraPose;
  exports.mat4ToCameraPose = mat4ToCameraPose;
  exports.mat4ToRowIndexArray = mat4ToRowIndexArray;
  exports.mat4MultiplyVector3 = mat4MultiplyVector3;
  exports.mat4MultiplyVector4 = mat4MultiplyVector4;
  exports.getCleanMat4 = getCleanMat4;
  exports.configureAugmentedCamera = configureAugmentedCamera;
})(SPMath);
