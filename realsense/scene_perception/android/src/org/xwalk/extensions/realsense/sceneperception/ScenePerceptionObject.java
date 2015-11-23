// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.scenePerception;

import android.app.Activity;
import android.hardware.Sensor;
import android.util.Log;
import android.util.Size;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.List;

import com.intel.camera.toolkit.depth.Camera;
import com.intel.camera.toolkit.depth.Camera.Calibration;
import com.intel.camera.toolkit.depth.Camera.Facing;
import com.intel.camera.toolkit.depth.Camera.Type;
import com.intel.camera.toolkit.depth.DepthUtils;
import com.intel.camera.toolkit.depth.Image;
import com.intel.camera.toolkit.depth.ImageSet;
import com.intel.camera.toolkit.depth.ImageInfo;
import com.intel.camera.toolkit.depth.Module;
import com.intel.camera.toolkit.depth.OnSenseManagerHandler;
import com.intel.camera.toolkit.depth.Point2DF;
import com.intel.camera.toolkit.depth.RSPixelFormat;
import com.intel.camera.toolkit.depth.sensemanager.IMUCaptureManager;
import com.intel.camera.toolkit.depth.sensemanager.SenseManager;
import com.intel.camera.toolkit.depth.sceneperception.SPCore;
import com.intel.camera.toolkit.depth.sceneperception.SPCore.CameraTrackListener;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.AsyncCallStatusResult;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.CameraPose;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.CameraStreamIntrinsics;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.SPInputStream;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.Status;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.Status;
import com.intel.camera.toolkit.depth.sceneperception.SPTypes.TrackingAccuracy;
import com.intel.camera.toolkit.depth.StreamProfile;
import com.intel.camera.toolkit.depth.StreamProfileSet;
import com.intel.camera.toolkit.depth.StreamType;
import com.intel.camera.toolkit.depth.StreamTypeSet;

import org.xwalk.app.runtime.extension.XWalkExtensionClient;
import org.xwalk.app.runtime.extension.XWalkExtensionContextClient;
import org.xwalk.extensions.common.*;

public class ScenePerceptionObject extends EventTarget {
    private static final String TAG = "ScenePerceptionObject";

    // active camera streaming profile
    private StreamProfileSet mStreamProfileSet = null;
    // current input size for color stream
    private Size mColorInputSize;
    // current input size for depth stream
    private Size mDepthInputSize;
    private String mPlaybackFile = null;

    private static SenseManager mSenseManager = null;
    // for capturing of gravity info    
    private IMUCaptureManager mIMUManager = null;
    private Activity mActivity;
    private int mInstaceID;
    private byte[] mPreviewColorBytes;
    private ImageInfo mPreviewColorInfo;
    private byte[] mPreviewDepthBytes;
    private ImageInfo mPreviewDepthInfo;
    private BindingObjectStore mBindingObjectStore;
    private Calibration mCalibration;
    private boolean mIsPreview = false;

    private SPCore mSPCore = null;  // instance of SP
    private int mSPResolution = SPTypes.SP_LOW_RESOLUTION;
    private CameraPose mCameraPose = new CameraPose(); // current camera pose
    // first camera pose to (re)start from
    private CameraPose mInitialCameraPose;
    //active state indicator SP process
    private AtomicBoolean mIsScenePerceptionActive = new AtomicBoolean(false);
    //indicator of having a request to reset camera tracking
    private volatile boolean mSPResetTracking = false;
    // threshold for percentage of coverage of valid depth values per depth 
    // input frame used for determining acceptable initial input frame.
    private final float ACCEPTABLE_INPUT_COVERAGE_PERC = 0.3f;  
    private CameraStreamIntrinsics mSPConfiguration; //chosen SP configuration profile
    //toggle on/off for live meshing
    private volatile boolean mIsMeshingTurnedOn = false; 
    private volatile boolean mIsReconstructionEnabled = true;
    private int mVolumeDataWidth = 0;
    private int mVolumeDataHight = 0;
    private ByteBuffer mVolumeRenderingRGBAImg = null;

    public ScenePerceptionObject(XWalkExtensionContextClient xwalkContext) {
        mActivity = xwalkContext.getActivity();
        mHandler.register("init", this);
        mHandler.register("start", this);
        mHandler.register("stop", this);
        mHandler.register("getSample", this);
        mHandler.register("enableReconstruction", this);
        mHandler.register("getVolumePreview", this);
        mHandler.register("isReconstructionEnabled", this);
    }

    protected SenseManager getSenseManager() {
        if (null == mSenseManager)
            mSenseManager = new SenseManager(mActivity);

        return mSenseManager;
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

    /**
     * Close delivery of IMU samples
     */
    private void stopImuManager(){
        try {
            if (mIMUManager != null) mIMUManager.close();
            mIMUManager = null;
        }
        catch (Exception e) {
            mIMUManager = null;
            Log.e(TAG, "Exception:" + e.getMessage());
        }       
    }
    
    /**
     * start delivery of IMU samples
     */
    private void startImuManager(){     
        try {
            if (null == mIMUManager) {
                mIMUManager = IMUCaptureManager.instance(mActivity);
            }
            if (mIMUManager != null) {
                if ( !mIMUManager.enableSensor(Sensor.TYPE_GRAVITY)) {
                    stopImuManager();
                    Log.e(TAG, "Failed to acquire gravity sensor");
                }
            }
        }
        catch (Exception e) {
            mIMUManager = null;
            Log.e(TAG, "Exception:" + e.getMessage());
        }
    }

    private class EnableStream implements Runnable {
        private FunctionInfo mInfo;
        EnableStream(FunctionInfo info) {
            mInfo = info;
        }

        @Override
        public void run() {
            try {
                if (null == mSPCore) {
                    reportMessage(mInfo, "", "please call init() firstly");
                    return;
                }
                getSenseManager().enableStreams(mSenseEventHandler, mStreamProfileSet, null);
                startImuManager();
                mSPCore.setSceneReconstructionEnabled(mIsReconstructionEnabled);
                reportMessage(mInfo, "success", "");
            } catch(Exception e) {
                reportMessage(mInfo, "", e.toString());
                Log.e(TAG, "Exception:" + e.getMessage());
                e.printStackTrace();
               
            }
        }
    }

    public void onInit(FunctionInfo info) {
        try {
            //start scene perception
            try {
                //switch to use different voxel resolution of Scene Perception
                getSenseManager().enableScenePerception(mSPResolution);
                mSPCore = getSenseManager().queryScenePerception();
            }
            catch (Exception e) {
                reportMessage(info, "", e.toString());
                Log.e(TAG, "Exception:" + e.getMessage());
                e.printStackTrace();
            }               
            Log.d(TAG, "Scene Perception enabled");
            List profileList = ((Module)mSPCore).getPreferredProfiles();
            boolean found = false;
            for (int i = 0; i < profileList.size(); ++i) {
                mStreamProfileSet = ((Module)mSPCore).getPreferredProfiles().get(i);
                if (mStreamProfileSet.hasStream(StreamType.DEPTH) &&
                    mStreamProfileSet.hasStream(StreamType.COLOR)) {
                     //choose QVGA depth and rgb
                    mDepthInputSize = new Size(mStreamProfileSet.get(StreamType.DEPTH).Width,
                            mStreamProfileSet.get(StreamType.DEPTH).Height);
                    mColorInputSize = new Size(mStreamProfileSet.get(StreamType.COLOR).Width,
                            mStreamProfileSet.get(StreamType.COLOR).Height);
                    found = true;
                    break;
                }
            }

            if (!found) {
                reportMessage(info, "", "cannot get correct sream profile set");
                return;
            }
            reportMessage(info, "success", "");
        } catch(Exception e) {
            reportMessage(info, "", e.toString());
            Log.e(TAG, "Exception:" + e.getMessage());
            e.printStackTrace();
        }
    }

    public void onStart(FunctionInfo info) {
        EnableStream enableStream = new EnableStream(info);
        mActivity.runOnUiThread(enableStream);
    }

    public void onStop(FunctionInfo info) {
        try {
            if (null == mSenseManager) {
                reportMessage(info, "", "scenemanager thread is not running");
                return;
            }
            getSenseManager().close();
            stopImuManager();
            if (mSPCore != null) mSPCore.pause();
            reportMessage(info, "success", "");
        } catch(Exception e) {
            reportMessage(info, "", e.toString());
            Log.e(TAG, "Exception:" + e.getMessage());
            e.printStackTrace();
        }
    }

    public void onDestroy(FunctionInfo info) {
        try {
            if (null == mSenseManager) {
                reportMessage(info, "", "scenemanager thread is not running");
                return;
            }
            getSenseManager().close();
            stopImuManager();
            if (mSPCore != null) mSPCore.pause();
            reportMessage(info, "success", "");
        } catch(Exception e) {
            reportMessage(info, "", e.toString());
            Log.e(TAG, "Exception:" + e.getMessage());
            e.printStackTrace();
        }
    }

    public void onGetSample(FunctionInfo info) {
        synchronized(this) {
            if (null == mPreviewColorBytes) {
                reportMessage(info, "", "please call start() firstly");
                return;
            }
            int colorDataOffset = 5 * (Integer.SIZE / Byte.SIZE);
            int depthDataOffset = colorDataOffset + mPreviewColorInfo.DataSize;
            ByteBuffer message = ByteBuffer.allocate(depthDataOffset + mPreviewDepthInfo.DataSize);
            message.order(ByteOrder.LITTLE_ENDIAN);
            message.rewind();
            message.putInt(Integer.parseInt(info.getCallbackId()));
            message.putInt(mPreviewColorInfo.Height);
            message.putInt(mPreviewColorInfo.Width);
            message.putInt(mPreviewDepthInfo.Height);
            message.putInt(mPreviewDepthInfo.Width);
            for (int i = 0; i < mPreviewColorInfo.Height * mPreviewColorInfo.Width; ++i) {
                message.put(mPreviewColorBytes[i * 4 + 0]);
                message.put(mPreviewColorBytes[i * 4 + 1]);
                message.put(mPreviewColorBytes[i * 4 + 2]);
                message.put(mPreviewColorBytes[i * 4 + 3]);
            }
            for (int i = 0; i < mPreviewDepthInfo.Height * mPreviewDepthInfo.Width; ++i) {
                message.put(mPreviewDepthBytes[i * 2 + 0]);
                message.put(mPreviewDepthBytes[i * 2 + 1]);
            }
            info.postResult(message.array());
        }
    }

    public void onIsReconstructionEnabled(FunctionInfo info) {
        try {
            JSONArray result = new JSONArray();
            result.put(0, mIsReconstructionEnabled);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onEnableReconstruction(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            mIsReconstructionEnabled = args.getBoolean(0);
            reportMessage(info, "success", "");
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
    }

    public void onGetVolumePreview(FunctionInfo info) {
        synchronized(this) {
            try {
                if (null == mSPCore) {
                    reportMessage(info, "", "please call init() firstly");
                    return;
                }
                JSONArray args = info.getArgs();
                float[] newPose = new float[12];
                for (int i = 0; i < 12; ++i)
                    newPose[i] = BigDecimal.valueOf(args.getJSONArray(0).getDouble(i)).floatValue();
                //allocate to the size of output image of SP module
                if (null == mVolumeRenderingRGBAImg) {
                    mVolumeDataWidth = mSPCore.getOutputImagePixelSize().getWidth() ;
                    mVolumeDataHight = mSPCore.getOutputImagePixelSize().getHeight();
                    //each pixel is of RGBA format
                    mVolumeRenderingRGBAImg = ByteBuffer.allocateDirect(mVolumeDataWidth * mVolumeDataHight *4);
                }
                SPTypes.Status status = mSPCore.getVolumeRenderImage(new CameraPose(newPose), mVolumeRenderingRGBAImg);
                if (Status.SP_STATUS_SUCCESS == status) {
                    int dataOffset = 3 * (Integer.SIZE / Byte.SIZE);
                    ByteBuffer message = ByteBuffer.allocate(dataOffset + mVolumeDataWidth * mVolumeDataHight *4);
                    message.order(ByteOrder.LITTLE_ENDIAN);
                    message.rewind();
                    message.putInt(Integer.parseInt(info.getCallbackId()));
                    message.putInt(mVolumeDataWidth);
                    message.putInt(mVolumeDataHight);
                    byte[] volumeBytes  = new byte[mVolumeDataWidth * mVolumeDataHight * 4];
                    mVolumeRenderingRGBAImg.get(volumeBytes);
                    for (int i = 0; i < mVolumeDataWidth * mVolumeDataHight; ++i) {
                        message.put(volumeBytes[i * 4 + 0]);
                        message.put(volumeBytes[i * 4 + 1]);
                        message.put(volumeBytes[i * 4 + 2]);
                        message.put(volumeBytes[i * 4 + 3]);
                    }
                    info.postResult(message.array());
                } else {
                    reportMessage(info, "", "failed to get volume render image.");
                }
            }catch(Exception e) {
                reportMessage(info, "", e.toString());
                Log.e(TAG, "Exception:" + e.getMessage());
                e.printStackTrace();
            }
        }
    }

    private Image mColorImg;
    private Image mDepthImg;
    private ImageSet mCurImgSet;
    private AtomicBoolean mIsDepthProcessorConfigured = new AtomicBoolean(false);
    float mSceneQuality = 0.0f;
    OnSenseManagerHandler mSenseEventHandler = new OnSenseManagerHandler()
    {
        @Override
        public void onSetProfile(Camera.CaptureInfo profiles) {
            // Configure Color Plane
            StreamProfile cs = profiles.getStreamProfiles().get(StreamType.COLOR);
            if(null == cs) {
                Log.e(TAG, "Error: NULL INDEX_COLOR");
            } else {
                Log.d(TAG, "Configuring color with format " +
                        cs.Format + " for width " + cs.Width +
                        " and height " + cs.Height);
                mPreviewColorBytes = new byte[cs.Width * cs.Height * 4];
            }

            // Configure Depth Plane
            StreamProfile ds = profiles.getStreamProfiles().get(StreamType.DEPTH);
            if(null == ds) {
                Log.e(TAG, "Error: NULL INDEX_DEPTH");
            } else {
                Log.d(TAG, "Configuring DisplayMode: format " + ds.Format +
                        " for width " + ds.Width + " and height " + ds.Height);
                mPreviewDepthBytes = new byte[ds.Width * ds.Height * 2];
            }

            Calibration.Intrinsics colorParams = null;
            Calibration.Intrinsics depthParams = null; 
            float[] depthToColorExtrinsicTranslation = null;
            Calibration calib = profiles.getCalibrationData();
            if (calib != null){
                colorParams = calib.colorIntrinsics;
                depthParams = calib.depthIntrinsics;
                depthToColorExtrinsicTranslation = new float[]{
                        calib.depthToColorExtrinsics.translation.x, 
                        calib.depthToColorExtrinsics.translation.y, 
                        calib.depthToColorExtrinsics.translation.z};
            } else {
                Log.e(TAG, "ERROR - camera calibration data is not accessible");
                return;
            }

            if (null == mSPCore) {
                Log.e(TAG, "ERROR - please call init() firstly");
            }
            Status spStatus = mSPCore.setConfiguration( new CameraStreamIntrinsics(depthParams, mDepthInputSize), 
                    new CameraStreamIntrinsics(colorParams, mColorInputSize), depthToColorExtrinsicTranslation, 
                    SPTypes.SP_LOW_RESOLUTION);
            if (spStatus != Status.SP_STATUS_SUCCESS) {
                Log.e(TAG, "ERROR - Scene Perception cannot be (re-)configured - " + spStatus);
            }
            else {
                mIsDepthProcessorConfigured.set(true);                  
                Log.d(TAG, "Scene Perception configured");

                mSPCore = mSenseManager.queryScenePerception();
                // set camera initial pose
                mInitialCameraPose = new CameraPose(CameraPose.IDENTITY_POSE);
                startScenePerception(mInitialCameraPose);
                
                Log.d(TAG, "Waiting for camera frames");   
            }
        }

        private SPInputStream curInput = new SPInputStream();
        // For detecting first frame to set gravity input
        private boolean mIsFirstFrame = true; 
        @Override
        public void onNewSample(ImageSet images) {
            mCurImgSet = images;
            Image color = images.acquireImage(StreamType.COLOR);
            Image depth = images.acquireImage(StreamType.DEPTH);
            if (color != null && depth != null) {
                ByteBuffer colorBuf = null;
                ByteBuffer depthBuf = null;
                if (null != color) {
                    mColorImg = color;
                    colorBuf = mColorImg.getImageBuffer();
                    colorBuf.rewind();
                    colorBuf.get(mPreviewColorBytes);
                    mPreviewColorInfo = mColorImg.getInfo();
                }
                if (null != depth) {
                    mDepthImg = depth;
                    depthBuf = mDepthImg.getImageBuffer();
                    depthBuf.rewind();
                    depthBuf.get(mPreviewDepthBytes);
                    mPreviewDepthInfo = mDepthImg.getInfo();
                }

                curInput.setValues(mDepthImg.getImageBuffer(), mColorImg.getImageBuffer(), 
                        mIMUManager.querySensorSamples(Sensor.TYPE_GRAVITY));
                if (mIsFirstFrame) {
                        mSPCore.setInitialCameraPose(SPUtils.alignPoseWithGravity(mInitialCameraPose, curInput));
                    mIsFirstFrame = false;
                }
                mSPCore.setInputs(curInput);

                if (isEventActive("checking")) {
                    float mSceneQuality = 0.0f;
                    try {
                        JSONObject data = new JSONObject();
                        mSceneQuality = mSPCore.getSceneQuality(curInput, false);
                        data.put("quality", mSceneQuality);
                        dispatchEvent("checking", data);
                    } catch (JSONException e) {
                        Log.e(TAG, e.toString());
                    } catch(Exception e) {
                        Log.e(TAG, "Exception:" + e.getMessage());
                        e.printStackTrace();
                    }
                }
            } else {
                mCurImgSet.releaseAllImages();
                mCurImgSet = null;
                mColorImg = null;
                mDepthImg = null;
                Log.e(TAG, "ERROR - fail to acquire camera frame");
            }
        }


        @Override
        public void onError(StreamProfileSet profile, int error) {
            Log.e(TAG, "Error: " + error);
        }
    };

    private class DepthCameraTrackListener implements CameraTrackListener {
        @Override
        public void onTrackingUpdate(TrackingAccuracy trackingResult,
                CameraPose newCamPose) {
            if (trackingResult != TrackingAccuracy.FAILED) {
                mCameraPose.set(newCamPose);

                if (isEventActive("sampleprocessed")) {
                    try {
                        JSONObject data = new JSONObject();
                        data.put("quality", mSceneQuality);
                        if (TrackingAccuracy.HIGH == trackingResult) {
                            data.put("accuracy", "high");
                        } else if (TrackingAccuracy.MED == trackingResult) {
                            data.put("accuracy", "med");
                        } else if (TrackingAccuracy.LOW == trackingResult) {
                            data.put("accuracy", "low");
                        }
                        JSONArray cameraPose = new JSONArray();
                        for (int i = 0; i < 12; ++i)
                            cameraPose.put(i, newCamPose.get()[i]);
                        data.put("cameraPose", cameraPose);
                        dispatchEvent("sampleprocessed", data);
                    } catch (JSONException e) {
                        Log.e(TAG, e.toString());
                    } catch(Exception e) {
                        Log.e(TAG, "Exception:" + e.getMessage());
                        e.printStackTrace();
                    }
                }
            }
        }

        @Override
        public void onTrackingError(Status trackingStatus) {
        }

        @Override
        public void onResetTracking(Status trackingStatus) {
        }

    }

    private void startScenePerception(CameraPose initialPose){
        if(null != mSPCore) {       
            mSPCore.setInitialCameraPose(initialPose);  
            //register for tracking event
            mSPCore.addCameraTrackListener(new DepthCameraTrackListener());
        }
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
    }
}