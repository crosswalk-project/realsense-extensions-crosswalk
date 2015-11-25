// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.util.Log;

import com.intel.camera.toolkit.depth.photography.core.DepthPhoto;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth.DepthEnhancementType;
import com.intel.camera.toolkit.depth.photography.utils.ResizeDepth;

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
    }

    public void onDepthResize(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONArray result = new JSONArray();
            JSONObject resizedJSONObject = new JSONObject();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                result.put(0, resizedJSONObject);
                result.put(1, "Invalid DepthPhoto Object");
                info.postResult(result);
                return;
            }

            int width = args.getInt(1);
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            int originalWidth = (int)depthPhoto.getDepthMap().getDepthData().getWidth();
            int originalHeight = (int)depthPhoto.getDepthMap().getDepthData().getHeight();
            int height = (int)(width * originalHeight / originalWidth);
            DepthPhoto resizedPhoto = ResizeDepth.resizeDepth(depthPhoto, width, height);

            DepthPhotoObject resizedPhotoObject = new DepthPhotoObject();
            resizedPhotoObject.setDepthPhoto(resizedPhoto);
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, resizedPhotoObject);

            resizedJSONObject.put("objectId", objectId);
            result.put(0, resizedJSONObject);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onEnhanceDepth(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONArray result = new JSONArray();
            JSONObject enhancedJSONObject = new JSONObject();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                result.put(0, enhancedJSONObject);
                result.put(1, "Invalid DepthPhoto Object");
                info.postResult(result);
                return;
            }

            EnhanceDepth.DepthEnhancementType enhanceType;
            String qulity = args.getString(1);
            if (qulity.equals("high")) {
                enhanceType = EnhanceDepth.DepthEnhancementType.HIGH_QUALITY;
            } else if (qulity.equals("low")) {
                enhanceType = EnhanceDepth.DepthEnhancementType.REAL_TIME;
            } else {
                result.put(0, enhancedJSONObject);
                result.put(1, "Invalid Depth Qulity");
                info.postResult(result);
                return;
            }
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            DepthPhoto enhancedPhoto =
                    (new EnhanceDepth()).enhanceDepth(depthPhoto, enhanceType);

            DepthPhotoObject enhancedPhotoObject = new DepthPhotoObject();
            enhancedPhotoObject.setDepthPhoto(enhancedPhoto);
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, enhancedPhotoObject);

            enhancedJSONObject.put("objectId", objectId);
            result.put(0, enhancedJSONObject);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

}
