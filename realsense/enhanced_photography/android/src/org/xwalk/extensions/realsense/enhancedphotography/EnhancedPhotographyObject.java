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

import java.lang.Byte;
import java.lang.Integer;
import java.lang.Runnable;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Vector;
import java.util.UUID;

import com.intel.camera.toolkit.depth.Camera;
import com.intel.camera.toolkit.depth.Camera.Calibration;
import com.intel.camera.toolkit.depth.Camera.Facing;
import com.intel.camera.toolkit.depth.Camera.Type;
import com.intel.camera.toolkit.depth.DepthUtils;
import com.intel.camera.toolkit.depth.Image;
import com.intel.camera.toolkit.depth.ImageSet;
import com.intel.camera.toolkit.depth.ImageInfo;
import com.intel.camera.toolkit.depth.OnSenseManagerHandler;
import com.intel.camera.toolkit.depth.photography.core.CameraPose;
import com.intel.camera.toolkit.depth.photography.core.DepthContext;
import com.intel.camera.toolkit.depth.photography.core.DepthMap;
import com.intel.camera.toolkit.depth.photography.core.DepthPhoto;
import com.intel.camera.toolkit.depth.photography.core.Device;
import com.intel.camera.toolkit.depth.photography.core.DevicePose;
import com.intel.camera.toolkit.depth.photography.core.EuclideanLocation;
import com.intel.camera.toolkit.depth.photography.core.FocalLength;
import com.intel.camera.toolkit.depth.photography.core.LensDistortion;
import com.intel.camera.toolkit.depth.photography.core.Rotation;
import com.intel.camera.toolkit.depth.photography.core.PerspectiveModel;
import com.intel.camera.toolkit.depth.photography.core.PixelData;
import com.intel.camera.toolkit.depth.photography.core.PrincipalPoint;
import com.intel.camera.toolkit.depth.photography.core.WGS84Location;
import com.intel.camera.toolkit.depth.photography.core.VendorInfo;
import com.intel.camera.toolkit.depth.photography.experiences.Measurement;
import com.intel.camera.toolkit.depth.photography.experiences.Measurement.Distance;
import com.intel.camera.toolkit.depth.photography.experiences.Refocus;
import com.intel.camera.toolkit.depth.photography.experiences.StickerPaster;
import com.intel.camera.toolkit.depth.photography.experiences.StickerPaster.StickerData;
import com.intel.camera.toolkit.depth.photography.utils.CommonFOV;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth;
import com.intel.camera.toolkit.depth.photography.utils.EnhanceDepth.DepthEnhancementType;
import com.intel.camera.toolkit.depth.photography.utils.ResizeDepth;
import com.intel.camera.toolkit.depth.Point2DF;
import com.intel.camera.toolkit.depth.Point3DF;
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
    private byte[] mPreviewColorBytes;
    private ImageInfo mPreviewColorInfo;
    private byte[] mPreviewDepthBytes;
    private ImageInfo mPreviewDepthInfo;
    private BindingObjectStore mBindingObjectStore;
    private Calibration mCalibration;
    private boolean mIsPreview = false;
    private static final int bytesPerInt = Integer.SIZE / Byte.SIZE;

    public EnhancedPhotographyObject(XWalkExtensionContextClient xwalkContext,
                                     BindingObjectStore bindingObjectStore) {
        mActivity = xwalkContext.getActivity();
        mBindingObjectStore = bindingObjectStore;
        mHandler.register("startPreview", this);
        mHandler.register("stopPreview", this);
        mHandler.register("getPreviewImage", this);
        mHandler.register("takePhoto", this);
        mHandler.register("measureDistance", this);
        mHandler.register("depthRefocus", this);
        mHandler.register("depthResize", this);
        mHandler.register("enhanceDepth", this);
        mHandler.register("pasteOnPlane", this);
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

    private class EnableStream implements Runnable {
        private FunctionInfo mInfo;
        EnableStream(FunctionInfo info) {
            mInfo = info;
        }

        @Override
        public void run() {
            try {
                getSenseManager().enableStreams(mSenseEventHandler, getUserProfiles(), null);
                mIsPreview = true;
                JSONArray result = new JSONArray();
                result.put(0, "success");
                mInfo.postResult(result);
            } catch (JSONException e) {
                Log.e(TAG, e.toString());
            } catch(Exception e) {
               Log.e(TAG, "Exception:" + e.getMessage());
               e.printStackTrace();
            }
        }
    }

    public void onStartPreview(FunctionInfo info) {
        EnableStream enableStream = new EnableStream(info);
        mActivity.runOnUiThread(enableStream);
    }

    public void onStopPreview(FunctionInfo info) {
        try {
            getSenseManager().close();
            mIsPreview = false;

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
            ByteBuffer message = ByteBuffer.allocate(
                    (int) (3 * bytesPerInt + mPreviewColorInfo.DataSize));
            message.order(ByteOrder.LITTLE_ENDIAN);
            message.rewind();
            message.putInt(Integer.parseInt(info.getCallbackId()));
            message.putInt(mPreviewColorInfo.Height);
            message.putInt(mPreviewColorInfo.Width);
            for (int i = 0; i < mPreviewColorInfo.Height * mPreviewColorInfo.Width; ++i) {
                message.put(mPreviewColorBytes[i * 4 + 0]);
                message.put(mPreviewColorBytes[i * 4 + 1]);
                message.put(mPreviewColorBytes[i * 4 + 2]);
                message.put(mPreviewColorBytes[i * 4 + 3]);
            }
            info.postResult(message.array());
        }
    }

    public void onTakePhoto(FunctionInfo info) {
        synchronized(this) {
            if (!mIsPreview) {
                try {
                    JSONArray result = new JSONArray();
                    result.put(0, "");
                    result.put(1, "Please startPreview to takePhoto");
                    info.postResult(result);
                } catch (JSONException e) {
                    Log.e(TAG, e.toString());
                }
            }

            DepthContext context = new DepthContext();

            PixelData depthData = new PixelData(context,
                                                mPreviewDepthInfo.Width,
                                                mPreviewDepthInfo.Height,
                                                PixelData.DataType.U16,
                                                PixelData.PixelFormat.GRAY);
            depthData.copyByteDataIn(mPreviewDepthBytes);

            DepthMap depthMap = new DepthMap(context,
                                             DepthMap.FormatType.RANGELINEAR,
                                             DepthMap.MeasureType.OPTICALAXIS);
            depthMap.setDepthData(depthData);

            depthMap.setNear(0);
            depthMap.setFar(0xFFFF);
            PixelData colorData = new PixelData(context,
                                                mPreviewColorInfo.Width,
                                                mPreviewColorInfo.Height,
                                                PixelData.DataType.U8,
                                                PixelData.PixelFormat.RGBA);
            colorData.copyByteDataIn(mPreviewColorBytes);
            colorData.setFileStorageMime("image/jpeg");
            com.intel.camera.toolkit.depth.photography.core.Image colorImage =
                    new com.intel.camera.toolkit.depth.photography.core.Image(context);
            colorImage.setPixelData(colorData);
            Point3DF translation = mCalibration.depthToColorExtrinsics.translation;

            Log.d(TAG, "translation: " + translation.x+ ", " + translation.y + ", " + translation.z);

            CameraPose relativePose;
            relativePose =
                    new CameraPose(context,
                                   new EuclideanLocation(-translation.x,
                                                         -translation.y,
                                                         -translation.z),
                                   new Rotation(0,0,0,0));

            VendorInfo vendorInfo = new VendorInfo(context);

            vendorInfo.setModel("R200");
            vendorInfo.setManufacturer("Intel");

            VendorInfo rawDepthVendorInfo = new VendorInfo(context);

            rawDepthVendorInfo.setModel("R200-rawdepth");
            rawDepthVendorInfo.setManufacturer("Intel Corporation");

            PerspectiveModel perspectiveModel = new PerspectiveModel(context);
            PerspectiveModel perspectiveModelRawDepth = new PerspectiveModel(context);

            Point2DF focalLengthColor = mCalibration.colorIntrinsicsNonRect.focalLength;
            Point2DF focalLengthDepth = mCalibration.depthIntrinsicsNonRect.focalLength;

            //normalize focal length
            focalLengthColor.x = focalLengthColor.x/Math.max(mPreviewColorInfo.Width, mPreviewColorInfo.Height);
            focalLengthColor.y = focalLengthColor.y/Math.max(mPreviewColorInfo.Width, mPreviewColorInfo.Height);

            focalLengthDepth.x = focalLengthDepth.x/Math.max(mPreviewDepthInfo.Width, mPreviewDepthInfo.Height);
            focalLengthDepth.y = focalLengthDepth.y/Math.max(mPreviewDepthInfo.Width, mPreviewDepthInfo.Height);

            Log.d(TAG, "focal length: " + focalLengthColor + " " + focalLengthDepth);

            perspectiveModel.setFocalLength(
                    new FocalLength(focalLengthColor.x, focalLengthColor.y));
            perspectiveModelRawDepth.setFocalLength(
                    new FocalLength(focalLengthDepth.x, focalLengthDepth.y));

            float[] distortionArray = mCalibration.colorIntrinsicsNonRect.lensDistortion;
            perspectiveModel.setLensDistortion(
                    new LensDistortion(distortionArray[0],
                                       distortionArray[1],
                                       distortionArray[2],
                                       distortionArray[3],
                                       distortionArray[4]));
            perspectiveModelRawDepth.setLensDistortion(new LensDistortion(0, 0, 0, 0, 0));

            Point2DF principalPointColor = mCalibration.colorIntrinsicsNonRect.principalPoint;
            Point2DF principalPointDepth = mCalibration.depthIntrinsicsNonRect.principalPoint;

            //normalize principal point
            principalPointColor.x = principalPointColor.x/mPreviewColorInfo.Width;
            principalPointColor.y = principalPointColor.y/mPreviewColorInfo.Height;

            principalPointDepth.x = principalPointDepth.x/mPreviewDepthInfo.Width;
            principalPointDepth.y = principalPointDepth.y/mPreviewDepthInfo.Height;

            Log.d(TAG, "principal point: " + principalPointColor + " " + principalPointDepth);

            perspectiveModel.setPrincipalPoint(
                    new PrincipalPoint(principalPointColor.x, principalPointColor.y));

            perspectiveModelRawDepth.setPrincipalPoint(
                    new PrincipalPoint(principalPointDepth.x, principalPointDepth.y));

            perspectiveModel.setSkew(0);
            perspectiveModelRawDepth.setSkew(0);

            com.intel.camera.toolkit.depth.photography.core.Camera camera =
                    new com.intel.camera.toolkit.depth.photography.core.Camera(context);
            camera.setImage(colorImage);
            camera.setImagingModel(perspectiveModel);
            camera.setPose(new CameraPose(
                    context, new EuclideanLocation(0, 0, 0), new Rotation(0, 0, 0, 0)));
            camera.setVendorInfo(vendorInfo);

            com.intel.camera.toolkit.depth.photography.core.Camera rawDepthCamera =
                    new com.intel.camera.toolkit.depth.photography.core.Camera(context);
            rawDepthCamera.setDepthMap(depthMap);
            rawDepthCamera.setPose(relativePose);
            rawDepthCamera.setImagingModel(perspectiveModelRawDepth);
            rawDepthCamera.setVendorInfo(rawDepthVendorInfo);

            DepthPhoto depthPhoto = new DepthPhoto(context);

            Device device = new Device(context);

            device.setPose(
                    new DevicePose(context, new WGS84Location(0,0,0), new Rotation(0,0,0,0)));

            depthPhoto.setMirrored(false);

            depthPhoto.setNumberOfCameras(2);

            device.setVendorInfo(vendorInfo);

            depthPhoto.setDevice(device);

            depthPhoto.setPrimaryImage(colorImage);

            Vector<com.intel.camera.toolkit.depth.photography.core.Camera> camerasVector =
                    new Vector<com.intel.camera.toolkit.depth.photography.core.Camera>();

            camerasVector.add(camera);
            camerasVector.add(rawDepthCamera);

            depthPhoto.setCameras(camerasVector);
            try {
                DepthPhoto fovDepthPhoto = CommonFOV.getCroppedDepthPhoto(depthPhoto);
                depthPhoto.close();
                Log.d(TAG, "get cropped depth photo done");

                EnhanceDepth enhancer = new EnhanceDepth();
                DepthPhoto enhancedDepthPhoto = enhancer.enhanceDepth(
                        fovDepthPhoto, DepthEnhancementType.REAL_TIME);
                fovDepthPhoto.close();
                Log.d(TAG, "depth enhance done");

                int colorImageWidth = (int) enhancedDepthPhoto.getPrimaryImage().getPixelData().getWidth();
                int colorImageHeight = (int) enhancedDepthPhoto.getPrimaryImage().getPixelData().getHeight();
                DepthPhoto resizedDepthPhoto = ResizeDepth.resizeDepth(
                        enhancedDepthPhoto, colorImageWidth, colorImageHeight);
                enhancedDepthPhoto.close();
                Log.d(TAG, "reszied depth to: " + colorImageWidth + ", " + colorImageHeight);

                DepthPhotoObject depthPhotoObject = new DepthPhotoObject();
                String objectId = UUID.randomUUID().toString();
                mBindingObjectStore.addBindingObject(objectId, depthPhotoObject);
                depthPhotoObject.setDepthPhoto(resizedDepthPhoto);

                JSONArray result = new JSONArray();
                JSONObject depthPhotoJSONObject = new JSONObject();
                depthPhotoJSONObject.put("objectId", objectId);
                result.put(0, depthPhotoJSONObject);
                info.postResult(result);
            } catch (JSONException e) {
                Log.e(TAG, e.toString());
            } catch (IOException e) {
                Log.e(TAG, e.toString());
            } catch (Exception e) {
                try {
                    JSONArray result = new JSONArray();
                    result.put(0, "");
                    result.put(1, e.toString());
                    info.postResult(result);
                } catch (JSONException exception) {
                    Log.e(TAG, exception.toString());
                }
                Log.e(TAG, e.toString());
                e.printStackTrace();
            }
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

    public void onDepthRefocus(FunctionInfo info) {
        try {
            JSONArray args = info.getArgs();
            JSONArray result = new JSONArray();
            JSONObject refocusJSONObject = new JSONObject();
            JSONObject photo = args.getJSONObject(0);
            String photoId = photo.getString("objectId");
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                result.put(0, refocusJSONObject);
                result.put(1, "Invalid DepthPhoto Object");
                info.postResult(result);
                return;
            }

            JSONObject point = args.getJSONObject(1);
            int pointX = point.getInt("x");
            int pointY = point.getInt("y");
            double aperture = args.getDouble(2);
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            Refocus refocus = new Refocus(new DepthContext(), depthPhoto);
            com.intel.camera.toolkit.depth.photography.core.Image refocusedImage =
                    refocus.apply(new PointF(pointX, pointY), (float)(aperture));

            DepthPhotoObject refocusPhotoObject = new DepthPhotoObject();
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, refocusPhotoObject);
            DepthPhoto refocusPhoto = refocusPhotoObject.getDepthPhoto();
            // See https://github.com/otcshare/realsense-extensions-crosswalk/issues/207
            refocusPhoto.setPrimaryImage(refocusedImage);
            // When setting the following properties, errors will happen.
            // See https://github.com/otcshare/realsense-extensions-crosswalk/issues/208
            // refocusPhoto.setUneditedPrimaryImage(depthPhoto.getUneditedPrimaryImage());
            // refocusPhoto.setDepthMap(depthPhoto.getDepthMap());

            refocusJSONObject.put("objectId", objectId);
            result.put(0, refocusJSONObject);
            info.postResult(result);
        } catch (JSONException e) {
            Log.e(TAG, e.toString());
        }
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

            JSONObject size = args.getJSONObject(1);
            int width = size.getInt("width");
            int height = size.getInt("height");
            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
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

    public void onPasteOnPlane(FunctionInfo info) {
        try {
            JSONArray result = new JSONArray();
            JSONObject stickerJSONObject = new JSONObject();

            ByteBuffer buffer = info.getBinaryArgs();
            buffer.order(ByteOrder.LITTLE_ENDIAN);
            int byteOffset = buffer.position();
            int photoIdLen = buffer.getInt(byteOffset);
            int alignedPhotoIdLen = photoIdLen + 4 -photoIdLen % 4;
            byteOffset += bytesPerInt;
            String photoId = new String(buffer.array(), byteOffset, photoIdLen);
            byteOffset += alignedPhotoIdLen;
            DepthPhotoObject depthPhotoObject =
                    (DepthPhotoObject)mBindingObjectStore.getBindingObject(photoId);
            if (depthPhotoObject == null) {
                result.put(0, stickerJSONObject);
                result.put(1, "Invalid DepthPhoto Object");
                info.postResult(result);
                return;
            }

            int width = buffer.getInt(byteOffset);
            byteOffset += bytesPerInt;
            int height = buffer.getInt(byteOffset);
            byteOffset += bytesPerInt;

            buffer.position(byteOffset);
            byte[] stickerBytes = new byte[width * height * 4];
            buffer.get(stickerBytes);
            DepthContext context = new DepthContext();
            PixelData stickerPixelData = new PixelData(context,
                                                       width,
                                                       height,
                                                       PixelData.DataType.U8,
                                                       PixelData.PixelFormat.RGBA);
            stickerPixelData.copyByteDataIn(stickerBytes);
            stickerPixelData.setFileStorageMime("image/jpeg");

            com.intel.camera.toolkit.depth.photography.core.Image stickerImage =
                    new com.intel.camera.toolkit.depth.photography.core.Image(context);
            stickerImage.setPixelData(stickerPixelData);

            int topLeftX = buffer.getInt();
            int topLeftY = buffer.getInt();
            int bottomLeftX = buffer.getInt();
            int bottomLeftY = buffer.getInt();

            DepthPhoto depthPhoto = depthPhotoObject.getDepthPhoto();
            StickerPaster stickerPaster = new StickerPaster(context, depthPhoto);
            StickerData stickerData = new StickerData();
            stickerData.sticker = stickerImage;
            stickerData.topLeftX = topLeftX;
            stickerData.topLeftY = topLeftY;
            stickerData.bottomLeftX = bottomLeftX;
            stickerData.bottomLeftY = bottomLeftY;
            stickerData.matchIllumination = true;
            stickerData.transparency = 0;
            stickerData.embossHighFreqPass = 0;
            stickerData.byPixelCorrection = false;
            stickerData.colorCorrection = false;
            stickerPaster.insertSticker(stickerData);
            DepthPhoto stickeredPhoto = stickerPaster.apply();

            DepthPhotoObject stikerPhotoObject = new DepthPhotoObject();
            stikerPhotoObject.setDepthPhoto(stickeredPhoto);
            String objectId = UUID.randomUUID().toString();
            mBindingObjectStore.addBindingObject(objectId, stikerPhotoObject);

            stickerJSONObject.put("objectId", objectId);
            result.put(0, stickerJSONObject);
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
            Log.d(TAG, "Camera Calibration: \n" + profiles.getCalibrationData());
            mCalibration = profiles.getCalibrationData().copy();
        }


        @Override
        public void onNewSample(ImageSet images) {
            Image color = images.acquireImage(StreamType.COLOR);
            Image depth = images.acquireImage(StreamType.DEPTH);

            synchronized(this) {
                if (null != color) {
                    color.getImageBuffer().rewind();
                    color.getImageBuffer().get(mPreviewColorBytes);
                    mPreviewColorInfo = color.getInfo();
                }
                if (null != depth) {
                    depth.getImageBuffer().rewind();
                    depth.getImageBuffer().get(mPreviewDepthBytes);
                    mPreviewDepthInfo = depth.getInfo();
                }
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
