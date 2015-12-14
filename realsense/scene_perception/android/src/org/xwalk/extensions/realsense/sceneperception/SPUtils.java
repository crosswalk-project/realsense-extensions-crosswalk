// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.scenePerception;

import com.intel.camera.toolkit.depth.sceneperception.SPTypes.CameraPose;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.SPInputStream;

/**
 * SPUtils includes a collection of functions and classes that helps to enable several functionalities in this extension.
 *
 */
public class SPUtils {
	 /**
     * normalizes a vector of 03 components so the length becomes 1.0f.
     * @param vector an array of 03 components of x, y and z coordinates, to be 
     * updated with normalized values. 
     * @return an array that contains normalized values. 
     */
    static public float[] normalizeVector(float[] vector) {
        double magnitude = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1] +
                vector[2] * vector[2]); 
        return new float[]{(float)(vector[0] / magnitude), (float)(vector[1] / magnitude),
                (float)(vector[2] / magnitude)};
    }

    /**
     * changes the camera pose's rotation matrix (3x3) (not translation / 
     * position) by taking a gravity vector to be the second row in the rotation 
     * matrix.
     * This is to ensure alignment of pose with the gravity so that the downward  
     * orientation (given by the gravity vector) is also the downward orientation 
     * of the reconstruction volume.
     * @param camPose the pose whose rotation matrix is to be updated.
     * @param input an input stream that includes samples of gravity whose values are in 
     * the coordinate system of Scene Perception. The first gravity sample will be used.
     * @return a new CameraPose whose rotation matrix is converted for alignment successfully or null
     * otherwise.
     */
    static public CameraPose alignPoseWithGravity(CameraPose camPose, SPInputStream input) {   
        CameraPose alignedPose = new CameraPose(camPose);
        if (input != null && camPose != null) {
            float[] gravity = input.getGravityValues();         
            if (gravity.length >= 3) {
                gravity = normalizeVector(gravity);
                if (!CameraPose.alignPoseWithGravity(alignedPose, gravity, 2)) {
                    alignedPose = null;
                }
            }
        }
        return alignedPose;
    }
}