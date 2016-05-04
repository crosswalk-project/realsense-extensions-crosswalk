// This script file should be loaded after THREE.js.
// Because, all the translations are based on THREE.Matrix4.
var SPMath = {};

(function(exports) {
  // Init the module.
  if (!THREE.Matrix4 instanceof Function) {
    console.error('No THREE.Matrix4 constructor found.');
    return;
  }
  newMatrixInterfaces();

  // Add new functions to Matrix4.
  function newMatrixInterfaces() {
    THREE.Matrix4.prototype.fromCameraPose = function(pose) {
      if (!Array.isArray(pose)) return;

      this.set(
          pose[0], pose[1], pose[2], pose[3],
          pose[4], pose[5], pose[6], pose[7],
          pose[8], pose[9], pose[10], pose[11],
          0, 0, 0, 1);
    };
    THREE.Matrix4.prototype.toCameraPose = function() {
      var me = this.elements;
      var array = [
        me[0], me[4], me[8], me[12],
        me[1], me[5], me[9], me[13],
        me[2], me[6], me[10], me[14]];
      return array;
    };
    THREE.Matrix4.prototype.toLineIndexArray = function() {
      var me = this.elements;
      var array = [
        me[0], me[4], me[8], me[12],
        me[1], me[5], me[9], me[13],
        me[2], me[6], me[10], me[14],
        me[3], me[7], me[11], me[15]];
      return array;
    };
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

    orth.multiply(K);
    orth.transpose();
    return orth;
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
    var orth = new THREE.Matrix4();
    orth.elements[0 + 0 * 4] = 2.0 / imgWidth;
    orth.elements[0 + 3 * 4] = -1.0;
    orth.elements[1 + 1 * 4] = 2.0 / imgHeight;
    orth.elements[1 + 3 * 4] = -1.0;
    orth.elements[2 + 2 * 4] = -2.0 / (farClip - nearClip);
    orth.elements[2 + 3 * 4] = -(farClip + nearClip) / (farClip - nearClip);
    orth.elements[3 + 3 * 4] = 1.0;

    return orth;
  }

  function setCameraParamsMatrix(alpha, beta, skew, u0, v0, nearClip, farClip) {
    var K = new THREE.Matrix4();
    K.elements[0 + 0 * 4] = alpha;
    K.elements[0 + 2 * 4] = -u0;
    K.elements[1 + 1 * 4] = beta;
    K.elements[1 + 2 * 4] = -v0;
    K.elements[2 + 2 * 4] = nearClip + farClip;
    K.elements[2 + 3 * 4] = nearClip * farClip;
    K.elements[3 + 2 * 4] = -1.0;
    return K;
  }

  // Export the module.
  exports.configureAugmentedCamera = configureAugmentedCamera;
})(SPMath);
