// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import org.xwalk.app.runtime.extension.XWalkExtensionClient;
import org.xwalk.app.runtime.extension.XWalkExtensionContextClient;

import android.app.Activity;
import android.util.Log;

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
import com.intel.camera.toolkit.depth.RSPixelFormat;
import com.intel.camera.toolkit.depth.sensemanager.SenseManager;
import com.intel.camera.toolkit.depth.StreamProfile;
import com.intel.camera.toolkit.depth.StreamProfileSet;
import com.intel.camera.toolkit.depth.StreamType;
import com.intel.camera.toolkit.depth.StreamTypeSet;

public class EnhancedPhotography extends XWalkExtensionClient {
    private static final String TAG = "EnhancedPhotography";
    protected XWalkExtensionContextClient mExtensionContextClient = null;
    private static SenseManager mSenseManager = null;
    private Activity mActivity;
    private int mInstaceID;
    private ByteBuffer mPreviewImageBuffer;
    private ImageInfo mPreviewImageInfo; 

    public EnhancedPhotography(String name, String jsApiContent,
                               XWalkExtensionContextClient xwalkContext) {
        super(name, jsApiContent, xwalkContext);
        mActivity = xwalkContext.getActivity();
    }

    private void handleMessage(int instanceID, String message) {
        try {
            mInstaceID = instanceID;

            JSONObject jsonInput = new JSONObject(message);
            String cmd = jsonInput.getString("cmd");

            if (cmd.equals("startPreview")) {
                startPreview(instanceID, jsonInput);
            } else if (cmd.equals("stopPreview")) {
                stopPreview(instanceID, jsonInput);
            } else if (cmd.equals("getPreviewImage")) {
                getPreviewImage(instanceID, jsonInput);
            } else {
                Log.e(TAG, "invalid command");
            }
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    protected SenseManager getSenseManager() {
        if (mSenseManager == null)
            mSenseManager = new SenseManager(mActivity);

        return mSenseManager;
    }
    
    protected void startPreview(int instanceID, JSONObject jsonInput) {
        try {
            getSenseManager().enableStreams(mSenseEventHandler, getUserProfiles(), null);

            JSONObject jsonOutput = new JSONObject();
            jsonOutput.put("data", "success");

            jsonOutput.put("asyncCallId", jsonInput.getString("asyncCallId"));
            postMessage(instanceID, jsonOutput.toString());
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
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

    protected void stopPreview(int instanceID, JSONObject jsonInput) {
        try {
            getSenseManager().close();

            JSONObject jsonOutput = new JSONObject();
            jsonOutput.put("data", "success");

            jsonOutput.put("asyncCallId", jsonInput.getString("asyncCallId"));
            postMessage(instanceID, jsonOutput.toString());
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
    }

    protected void getPreviewImage(int instanceID, JSONObject jsonInput) {
        synchronized(this) {
            try {
                Log.d(TAG, "getPreviewImage");
                int asyncCallId = Integer.parseInt(jsonInput.getString("asyncCallId"));
                
                ByteBuffer message =
                        ByteBuffer.allocate((int) (3 * 4 + mPreviewImageInfo.DataSize));
                message.order(ByteOrder.LITTLE_ENDIAN);
                message.rewind();
                message.putInt(asyncCallId);
                message.putInt(mPreviewImageInfo.Height);
                message.putInt(mPreviewImageInfo.Width);
                for (int i = 0; i < mPreviewImageInfo.Height * mPreviewImageInfo.Width; ++i) {
                    message.put(mPreviewImageBuffer.get(i * 4 + 0));
                    message.put(mPreviewImageBuffer.get(i * 4 + 1));
                    message.put(mPreviewImageBuffer.get(i * 4 + 2));
                    message.put(mPreviewImageBuffer.get(i * 4 + 3));
                }
                postBinaryMessage(instanceID, message.array());
            } catch (JSONException e) {
                Log.e(TAG, e.toString());
            }
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

            try {
                JSONObject jsonOutput = new JSONObject();
                jsonOutput.put("event", "onpreview");
                postMessage(mInstaceID, jsonOutput.toString());
            } catch (JSONException e) {
                Log.e(TAG, e.toString());
            }
        }


        @Override
        public void onError(StreamProfileSet profile, int error) {
            Log.e(TAG, "Error: " + error);
        }
    };


    @Override
    public void onMessage(int instanceID, String message) {
        if (!message.isEmpty()) handleMessage(instanceID, message);
    }

    @Override
    public String onSyncMessage(int instanceID, String message) {
        return null;
    }

    @Override
    public void onPause() {
        Log.d(TAG, "onPause");
        try {
            getSenseManager().close();
        } catch(Exception e) {
           Log.e(TAG, "Exception:" + e.getMessage());
           e.printStackTrace();
        }
        super.onPause();
    }
}
