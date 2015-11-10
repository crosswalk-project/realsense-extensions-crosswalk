// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.Byte;
import java.lang.Integer;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import com.intel.camera.toolkit.depth.photography.core.*;
import com.intel.camera.toolkit.depth.photography.reader.DepthReader;

import org.xwalk.extensions.common.*;

public class DepthPhotoObject extends BindingObject {
    private static final String TAG = "DepthPhotoObject";
    private DepthPhoto mDepthPhoto;
    private static final int bytesPerInt = Integer.SIZE / Byte.SIZE;

    public DepthPhotoObject() {
        mDepthPhoto = new DepthPhoto(new DepthContext());
        mHandler.register("loadXDM", this);
        mHandler.register("queryReferenceImage", this);
        mHandler.register("queryOriginalImage", this);
        mHandler.register("queryDepthImage", this);
        mHandler.register("queryRawDepthImage", this);
    }

    private void reportMessage(FunctionInfo info, String data, String error) {
        try {
            JSONArray result = new JSONArray();
            result.put(0, data);
            result.put(1, error);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    private void queryColorImage(FunctionInfo info, Image image) {
        if (image == null) {
            reportMessage(info, "", "There is no image info");
            return;
        }

        PixelData colorData = image.getPixelData();
        Log.d(TAG, "PixelData: " + colorData.getWidth() + ", " + colorData.getHeight() +
                ", " + colorData.getPixelFormat() + ", " + colorData.getBytesPerPixel());
        int height = (int)colorData.getHeight();
        int width =  (int)colorData.getWidth();
        int pixelLength = width * height;
        // RGBA format is 4 bytes per pixel
        int pixelBytesLength = pixelLength * 4;
        byte[] colorBytes;

        if (colorData.getPixelFormat() == PixelData.PixelFormat.BGR) {
            byte[] srcBytes = colorData.copyByteDataOut();
            colorBytes = new byte[pixelBytesLength];

            for (int a = 0; a < srcBytes.length / 3; a++) {
                colorBytes[a * 4] = srcBytes[a * 3 + 2];      // b
                colorBytes[a * 4 + 1] = srcBytes[a * 3 + 1];  // g
                colorBytes[a * 4 + 2] = srcBytes[a * 3 + 0];  // r
                colorBytes[a * 4 + 3] = (byte)0xff;           // a
            }
        } else if (colorData.getPixelFormat() == PixelData.PixelFormat.RGBA) {
            byte[] srcBytes = colorData.copyByteDataOut();
            colorBytes = new byte[pixelBytesLength];

            for (int a = 0; a < srcBytes.length / 4; a++) {
                colorBytes[a * 4] = srcBytes[a * 4 + 2];
                colorBytes[a * 4 + 1] = srcBytes[a * 4 + 1];
                colorBytes[a * 4 + 2] = srcBytes[a * 4 + 0];
                colorBytes[a * 4 + 3] = srcBytes[a * 4 + 3];
            }
        } else if (colorData.getPixelFormat() == PixelData.PixelFormat.BGRA) {
            colorBytes = colorData.copyByteDataOut();
        } else {
            // FIXME(Jiajia): Need to support other PixelFormat
            reportMessage(info, "", "Unsupported pixel format");
            return;
        }

        // Binary message: callbackId(int), width(int), height(int), colorImageData
        ByteBuffer message = ByteBuffer.allocate((int) (3 * bytesPerInt + pixelBytesLength));
        message.order(ByteOrder.LITTLE_ENDIAN);
        message.rewind();
        message.putInt(Integer.parseInt(info.getCallbackId()));
        message.putInt(width);
        message.putInt(height);
        for (int i = 0; i < pixelLength; ++i) {
            message.put(colorBytes[i * 4 + 0]);
            message.put(colorBytes[i * 4 + 1]);
            message.put(colorBytes[i * 4 + 2]);
            message.put(colorBytes[i * 4 + 3]);
        }
        info.postResult(message.array());
    }

    public DepthPhoto getDepthPhoto() {
        return mDepthPhoto;
    }

    public void setDepthPhoto(DepthPhoto depthPhoto) {
        mDepthPhoto = depthPhoto;
    }

    public void onLoadXDM(FunctionInfo info) {
        try {
            ByteBuffer buffer = info.getBinaryArgs();
            int offset = buffer.position();
            int count = buffer.array().length - offset;
            File file = File.createTempFile("temp", ".jpg");
            String fileName = file.getAbsolutePath();
            Log.d(TAG, "fileName = " + fileName);
            FileOutputStream fo = new FileOutputStream(file);
            fo.write(buffer.array(), offset, count);
            fo.flush();
            fo.close();

            if (!DepthReader.isXDMFile(new DepthContext(), fileName)) {
                String errMsg = "The selected file is not a compatible image for this app.";
                reportMessage(info, "", errMsg);
                return;
            }

            DepthContext context = new DepthContext();
            mDepthPhoto = DepthReader.read(context, fileName);
            if (mDepthPhoto == null) {
                String errMsg = "loadXDM failed";
                reportMessage(info, "", errMsg);
                return;
            }
            reportMessage(info, "success", "");
        } catch (IOException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onQueryReferenceImage(FunctionInfo info) {
        if (mDepthPhoto == null) {
            String errMsg = "DepthPhoto is uninitialized.";
            reportMessage(info, "", errMsg);
            return;
        }

        Image image = mDepthPhoto.getPrimaryImage();
        queryColorImage(info, image);
    }

    public void onQueryOriginalImage(FunctionInfo info) {
        if (mDepthPhoto == null) {
            String errMsg = "DepthPhoto is uninitialized.";
            reportMessage(info, "", errMsg);
            return;
        }

        Image image = mDepthPhoto.getUneditedPrimaryImage();
        queryColorImage(info, image);
    }

    public void onQueryDepthImage(FunctionInfo info) {
        if (mDepthPhoto == null) {
            String errMsg = "DepthPhoto is uninitialized.";
            reportMessage(info, "", errMsg);
            return;
        }

        PixelData depthData = mDepthPhoto.getDepthMap().getDepthData();
        Log.d(TAG, "depthData: " + depthData.getWidth() + ", " + depthData.getHeight() +
                ", " + depthData.getPixelFormat() + ", " + depthData.getBytesPerPixel());

        byte[] depthBytes = depthData.copyByteDataOut();
        long byteLength =
                depthData.getHeight() * depthData.getWidth() * depthData.getBytesPerPixel();
        // Binary message: callbackId(int), width(int), height(int), depthImageData
        ByteBuffer message = ByteBuffer.allocate((int) (3 * bytesPerInt + byteLength));
        message.order(ByteOrder.LITTLE_ENDIAN);
        message.rewind();
        message.putInt(Integer.parseInt(info.getCallbackId()));
        message.putInt((int)depthData.getWidth());
        message.putInt((int)depthData.getHeight());
        for (int i = 0; i < byteLength; ++i) {
            message.put(depthBytes[i]);
        }
        info.postResult(message.array());
    }

    public void onQueryRawDepthImage(FunctionInfo info) {
        // FIXME(Jiajia): See https://github.com/otcshare/realsense-extensions-crosswalk/issues/204
        onQueryDepthImage(info);
    }
}
