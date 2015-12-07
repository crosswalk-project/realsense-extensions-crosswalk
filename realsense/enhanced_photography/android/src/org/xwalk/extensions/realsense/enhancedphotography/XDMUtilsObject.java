// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.util.Log;

import com.intel.camera.toolkit.depth.photography.core.DepthContext;
import com.intel.camera.toolkit.depth.photography.core.DepthPhoto;
import com.intel.camera.toolkit.depth.photography.reader.DepthReader;
import com.intel.camera.toolkit.depth.photography.writer.DepthWriter;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.Byte;
import java.lang.Integer;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.UUID;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import org.xwalk.extensions.common.BindingObject;
import org.xwalk.extensions.common.BindingObjectStore;
import org.xwalk.extensions.common.FunctionInfo;

public class XDMUtilsObject extends BindingObject {
    private static final String TAG = "XDMUtilsObject";
    private BindingObjectStore mBindingObjectStore;
    private static final int bytesPerInt = Integer.SIZE / Byte.SIZE;

    public XDMUtilsObject(BindingObjectStore bindingObjectStore) {
        mBindingObjectStore = bindingObjectStore;
        mHandler.register("isXDM", this);
        mHandler.register("loadXDM", this);
        mHandler.register("saveXDM", this);
    }

    private void reportBooleanMessage(FunctionInfo info, boolean data, String error) {
        try {
            JSONArray result = new JSONArray();
            result.put(0, data);
            result.put(1, error);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    private void reportStringErrorMessage(FunctionInfo info, String error) {
        try {
            JSONArray result = new JSONArray();
            result.put(0, "");
            result.put(1, error);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    private void CreateFileWithByteBuffer(ByteBuffer buffer, File file) {
        try {
            int offset = buffer.position();
            int count = buffer.array().length - offset;
            FileOutputStream fo = new FileOutputStream(file);
            fo.write(buffer.array(), offset, count);
            fo.flush();
            fo.close();
        } catch (IOException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onIsXDM(FunctionInfo info) {
        try {
            ByteBuffer buffer = info.getBinaryArgs();
            File file = File.createTempFile("temp", ".jpg");
            CreateFileWithByteBuffer(buffer, file);

            String fileName = file.getAbsolutePath();
            if (DepthReader.isXDMFile(new DepthContext(), fileName)) {
                reportBooleanMessage(info, true, "");
                return;
            } else {
                reportBooleanMessage(info, false, "");
            }
        } catch (IOException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onLoadXDM(FunctionInfo info) {
        try {
            ByteBuffer buffer = info.getBinaryArgs();
            File file = File.createTempFile("temp", ".jpg");
            CreateFileWithByteBuffer(buffer, file);

            String fileName = file.getAbsolutePath();
            DepthPhoto depthPhoto = DepthReader.read(new DepthContext(), fileName);
            if (depthPhoto == null) {
                String errMsg = "loadXDM failed";
                reportStringErrorMessage(info, errMsg);
                return;
            }

            DepthPhotoObject photoObject = new DepthPhotoObject();
            photoObject.setDepthPhoto(depthPhoto);
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, photoObject);

            try {
                JSONArray result = new JSONArray();
                JSONObject photoJSONObject = new JSONObject();
                photoJSONObject.put("objectId", objectId);
                result.put(0, photoJSONObject);
                info.postResult(result);
            } catch (JSONException e) {
                Log.e(TAG, e.toString());
            }
        } catch (IOException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onSaveXDM(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                String errMsg = "Invalid DepthPhoto Object";
                reportStringErrorMessage(info, errMsg);
                return;
            }

            File file = File.createTempFile("temp", ".jpg");
            String fileName = file.getAbsolutePath();
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            DepthWriter.write(new DepthContext(), fileName, depthPhoto);

            FileInputStream fi = new FileInputStream(file);
            int byteCount = (int)file.length();
            byte[] data = new byte[byteCount];
            fi.read(data, 0, byteCount);
            fi.close();

            // Binary message: callbackId(int), data
            ByteBuffer message = ByteBuffer.allocate(bytesPerInt + byteCount);
            message.order(ByteOrder.LITTLE_ENDIAN);
            message.rewind();
            message.putInt(Integer.parseInt(info.getCallbackId()));
            message.put(data);
            info.postResult(message.array());
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        } catch (IOException e) {
            Log.e(TAG, e.toString());
        }
    }
}
