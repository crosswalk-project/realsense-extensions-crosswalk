// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.app.Activity;
import android.graphics.PointF;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;

import com.intel.camera.toolkit.depth.Camera;
import com.intel.camera.toolkit.depth.Camera.Facing;
import com.intel.camera.toolkit.depth.Camera.Type;
import com.intel.camera.toolkit.depth.DepthUtils;
import com.intel.camera.toolkit.depth.Image;
import com.intel.camera.toolkit.depth.ImageSet;
import com.intel.camera.toolkit.depth.ImageInfo;
import com.intel.camera.toolkit.depth.OnSenseManagerHandler;
import com.intel.camera.toolkit.depth.photography.core.DepthContext;
import com.intel.camera.toolkit.depth.photography.core.DepthPhoto;
import com.intel.camera.toolkit.depth.photography.experiences.Measurement;
import com.intel.camera.toolkit.depth.photography.experiences.Measurement.Distance;
import com.intel.camera.toolkit.depth.RSPixelFormat;
import com.intel.camera.toolkit.depth.sensemanager.SenseManager;
import com.intel.camera.toolkit.depth.StreamProfile;
import com.intel.camera.toolkit.depth.StreamProfileSet;
import com.intel.camera.toolkit.depth.StreamType;
import com.intel.camera.toolkit.depth.StreamTypeSet;

import org.xwalk.app.runtime.extension.XWalkExtensionClient;
import org.xwalk.app.runtime.extension.XWalkExtensionContextClient;
import org.xwalk.extensions.common.*;

public class EnhancedPhotographyObject extends EventTarget {
    private static final String TAG = "EnhancedPhotographyObject";
    private static SenseManager mSenseManager = null;
    private Activity mActivity;
    private int mInstaceID;
    private ByteBuffer mPreviewImageBuffer;
    private ImageInfo mPreviewImageInfo;
    private BindingObjectStore mBindingObjectStore;

    public EnhancedPhotographyObject(XWalkExtensionContextClient xwalkContext,
                                     BindingObjectStore bindingObjectStore) {
        mActivity = xwalkContext.getActivity();
        mBindingObjectStore = bindingObjectStore;
        mHandler.register("startPreview", this);
        mHandler.register("stopPreview", this);
        mHandler.register("getPreviewImage", this);
        mHandler.register("measureDistance", this);
    }

    protected SenseManager getSenseManager() {
        if (mSenseManager == null)
            mSenseManager = new SenseManager(mActivity);

        return mSenseManager;
    }

    private StreamProfileSet getUserProfiles() {
        StreamProfileSet set = new StreamProfileSet();
        StreamProfile colorProfile =
                new StreamProfile(640, 480, RSPixelFormat.RGBA_8888, 30, StreamType.COLOR);
        StreamProfile depthProfile =
                new StreamProfile(480, 360, RSPixelFormat.Z16, 30, StreamType.DEPTH);
        set.set(StreamType.COLOR, colorProfile);
        set.set(StreamType.DEPTH, depthProfile);

        return set;
    }

    public void onStartPreview(FunctionInfo info) {
        try {
            getSenseManager().enableStreams(mSenseEventHandler, getUserProfiles(), null);

            JSONArray result = new JSONArray();
            result.put(0, "success");
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
    }

    public void onStopPreview(FunctionInfo info) {
        try {
            getSenseManager().close();

            JSONArray result = new JSONArray();
            result.put(0, "success");
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
    }

    public void onGetPreviewImage(FunctionInfo info) {
        synchronized(this) {
            ByteBuffer message =
                    ByteBuffer.allocate((int) (3 * 4 + mPreviewImageInfo.DataSize));
            message.order(ByteOrder.LITTLE_ENDIAN);
            message.rewind();
            message.putInt(Integer.parseInt(info.getCallbackId()));
            message.putInt(mPreviewImageInfo.Height);
            message.putInt(mPreviewImageInfo.Width);
            for (int i = 0; i < mPreviewImageInfo.Height * mPreviewImageInfo.Width; ++i) {
                message.put(mPreviewImageBuffer.get(i * 4 + 0));
                message.put(mPreviewImageBuffer.get(i * 4 + 1));
                message.put(mPreviewImageBuffer.get(i * 4 + 2));
                message.put(mPreviewImageBuffer.get(i * 4 + 3));
            }
            info.postResult(message.array());
        }
    }

    public void onMeasureDistance(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONArray result = new JSONArray();
            JSONObject distanceObject = new JSONObject();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                result.put(0, distanceObject);
                result.put(1, "Invalid DepthPhoto Object");
                info.postResult(result);
                return;
            }

            JSONObject startPoint = args.getJSONObject(1);
            JSONObject endPoint = args.getJSONObject(2);
            int startX = startPoint.getInt("x");
            int startY = startPoint.getInt("y");
            int endX = endPoint.getInt("x");
            int endY = endPoint.getInt("y");
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            Measurement measurement = new Measurement(new DepthContext(), depthPhoto);
            Distance dist = measurement.computeDistance(
                    new PointF(startX, startY), new PointF(endX,endY));
            double distance = dist.distance;
            distanceObject.put("distance", distance);
            result.put(0, distanceObject);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    OnSenseManagerHandler mSenseEventHandler = new OnSenseManagerHandler()
    {
        @Override
        public void onSetProfile(Camera.CaptureInfo profiles) {
            Log.d(TAG, "OnSetProfile");
            // Configure Color Plane
            StreamProfile cs = profiles.getStreamProfiles().get(StreamType.COLOR);
            if(null == cs) {
                Log.e(TAG, "Error: NULL INDEX_COLOR");
            } else {
                Log.d(TAG, "Configuring color with format " +
                        cs.Format + " for width " + cs.Width +
                        " and height " + cs.Height);
            }

            // Configure Depth Plane
            StreamProfile ds = profiles.getStreamProfiles().get(StreamType.DEPTH);
            if(null == ds) {
                Log.e(TAG, "Error: NULL INDEX_DEPTH");
            } else {
                Log.d(TAG, "Configuring DisplayMode: format " + ds.Format +
                        " for width " + ds.Width + " and height " + ds.Height);
            }
            Log.d(TAG, "Camera Calibration: \n" + profiles.getCalibrationData());
        }


        @Override
        public void onNewSample(ImageSet images) {
            Image color = images.acquireImage(StreamType.COLOR);
            if (null == color) return;

            synchronized(this) {
                mPreviewImageBuffer = ByteBuffer.wrap(color.getImageBuffer().array());
                mPreviewImageInfo = color.getInfo();
            }

            if (isEventActive("preview"))
                dispatchEvent("preview");
        }


        @Override
        public void onError(StreamProfileSet profile, int error) {
            Log.e(TAG, "Error: " + error);
        }
    };

    @Override
    public void onPause() {
        Log.d(TAG, "onPause");
        try {
            getSenseManager().close();
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
    }
}
