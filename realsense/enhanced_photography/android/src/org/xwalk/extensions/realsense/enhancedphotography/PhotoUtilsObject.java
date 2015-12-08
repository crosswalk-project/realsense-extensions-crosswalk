// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.util.Log;

import com.intel.camera.toolkit.depth.photography.core.DepthPhoto;
import com.intel.camera.toolkit.depth.photography.core.DPRect;
import com.intel.camera.toolkit.depth.photography.core.DPPoint;
import com.intel.camera.toolkit.depth.photography.utils.Crop;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth.DepthEnhancementType;
import com.intel.camera.toolkit.depth.photography.utils.ResizeDepth;
import com.intel.camera.toolkit.depth.photography.utils.Rotate;

import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import org.xwalk.extensions.common.BindingObject;
import org.xwalk.extensions.common.BindingObjectStore;
import org.xwalk.extensions.common.FunctionInfo;

public class PhotoUtilsObject extends BindingObject {
    private static final String TAG = "PhotoUtilsObject";
    private BindingObjectStore mBindingObjectStore;

    public PhotoUtilsObject(BindingObjectStore bindingObjectStore) {
        mBindingObjectStore = bindingObjectStore;
        mHandler.register("depthResize", this);
        mHandler.register("enhanceDepth", this);
        mHandler.register("photoCrop", this);
        mHandler.register("photoRotate", this);
    }

    private void reportErrorMessage(String error, FunctionInfo info) {
        try {
            JSONArray result = new JSONArray();
            result.put(0, "");
            result.put(1, error);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    private void createPhotoObjectAndReply(DepthPhoto photo, FunctionInfo info) {
        try {
            DepthPhotoObject photoObject = new DepthPhotoObject();
            photoObject.setDepthPhoto(photo);
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, photoObject);

            JSONArray result = new JSONArray();
            JSONObject photoJSONObject = new JSONObject();
            photoJSONObject.put("objectId", objectId);
            result.put(0, photoJSONObject);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onDepthResize(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                reportErrorMessage("Invalid DepthPhoto Object", info);
                return;
            }

            int width = args.getInt(1);
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            int originalWidth = (int)depthPhoto.getDepthMap().getDepthData().getWidth();
            int originalHeight = (int)depthPhoto.getDepthMap().getDepthData().getHeight();
            int height = (int)(width * originalHeight / originalWidth);
            DepthPhoto resizedPhoto = ResizeDepth.resizeDepth(depthPhoto, width, height);

            createPhotoObjectAndReply(resizedPhoto, info);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onEnhanceDepth(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                reportErrorMessage("Invalid DepthPhoto Object", info);
                return;
            }

            EnhanceDepth.DepthEnhancementType enhanceType =
                    EnhanceDepth.DepthEnhancementType.HIGH_QUALITY;
            String qulity = args.getString(1);
            if (qulity.equals("high")) {
                enhanceType = EnhanceDepth.DepthEnhancementType.HIGH_QUALITY;
            } else if (qulity.equals("low")) {
                enhanceType = EnhanceDepth.DepthEnhancementType.REAL_TIME;
            } else {
                reportErrorMessage("Invalid Depth Qulity", info);
            }
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            DepthPhoto enhancedPhoto =
                    (new EnhanceDepth()).enhanceDepth(depthPhoto, enhanceType);

            createPhotoObjectAndReply(enhancedPhoto, info);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onPhotoCrop(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                reportErrorMessage("Invalid DepthPhoto Object", info);
                return;
            }

            JSONObject rect = args.getJSONObject(1);
            int x = rect.getInt("x");
            int y = rect.getInt("y");
            int w = rect.getInt("w");
            int h = rect.getInt("h");
            DPRect dpRect = new DPRect();
            dpRect.setTopLeftPoint(new DPPoint(x, y));
            dpRect.setBottomRightPoint(new DPPoint(x + w, y + h));
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            DepthPhoto cropPhoto = Crop.crop(depthPhoto, dpRect);

            createPhotoObjectAndReply(cropPhoto, info);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onPhotoRotate(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                reportErrorMessage("Invalid DepthPhoto Object", info);
                return;
            }

            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            // Currently, windows only support clock-wise 90-degree rotation
            // So, here we directly set the fixed parameters.
            // double rotation = args.getDouble("rotation");
            DepthPhoto rotatePhoto = Rotate.rotate(depthPhoto,
                                                   Rotate.RotateDirection.Clockwise,
                                                   Rotate.FixedDegrees.Degrees_90);

            createPhotoObjectAndReply(rotatePhoto, info);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }
}
