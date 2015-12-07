// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.enhancedphotography;

import android.app.Activity;
import android.util.Log;

import org.xwalk.app.runtime.extension.XWalkExtensionClient;
import org.xwalk.app.runtime.extension.XWalkExtensionContextClient;
import org.xwalk.extensions.common.*;

public class EnhancedPhotographyExtension extends XWalkExtensionClient {
    private static final String TAG = "EnhancedPhotographyExtension";
    protected XWalkExtensionContextClient mExtensionContextClient = null;
    private BindingObjectStore mBindingObjectStore;
    private FunctionHandler mHandler;

    public EnhancedPhotographyExtension(
            String name, String jsApiContent, XWalkExtensionContextClient xwalkContext) {
        super(name, jsApiContent, xwalkContext);
        mExtensionContextClient = xwalkContext;
        mHandler = new FunctionHandler();
        mBindingObjectStore = new BindingObjectStore(mHandler);

        mHandler.register("enhancedPhotographyConstructor", this);
        mHandler.register("depthPhotoConstructor", this);
        mHandler.register("photoUtilsConstructor", this);
        mHandler.register("XDMUtilsConstructor", this);
    }

    private void handleMessage(int instanceID, String message) {
        FunctionInfo info = new FunctionInfo(this, instanceID, message);
        mHandler.handleFunction(info);
    }

    private void handleBinaryMessage(int instanceID, byte[] message) {
        FunctionInfo info = new FunctionInfo(this, instanceID, message);
        mHandler.handleFunction(info);
    }

    public void onEnhancedPhotographyConstructor(FunctionInfo info) {
        EnhancedPhotographyObject ep =
                new EnhancedPhotographyObject(mExtensionContextClient, mBindingObjectStore);
        mBindingObjectStore.addBindingObject(info.getObjectId(), ep);
    }

    public void onDepthPhotoConstructor(FunctionInfo info) {
        DepthPhotoObject dp = new DepthPhotoObject();
        mBindingObjectStore.addBindingObject(info.getObjectId(), dp);
    }

    public void onPhotoUtilsConstructor(FunctionInfo info) {
        PhotoUtilsObject pu = new PhotoUtilsObject(mBindingObjectStore);
        mBindingObjectStore.addBindingObject(info.getObjectId(), pu);
    }

    public void onXDMUtilsConstructor(FunctionInfo info) {
        XDMUtilsObject xu = new XDMUtilsObject(mBindingObjectStore);
        mBindingObjectStore.addBindingObject(info.getObjectId(), xu);
    }

    @Override
    public void onMessage(int instanceID, String message) {
        if (!message.isEmpty()) handleMessage(instanceID, message);
    }

    @Override
    public void onBinaryMessage(int instanceID, byte[] message) {
        if (message != null) handleBinaryMessage(instanceID, message);
    }

    @Override
    public String onSyncMessage(int instanceID, String message) {
        return null;
    }

    @Override
    public void onStart() {
        mBindingObjectStore.onStart();
        super.onStart();
    }

    @Override
    public void onResume() {
        mBindingObjectStore.onResume();
        super.onResume();
    }

    @Override
    public void onPause() {
        mBindingObjectStore.onPause();
        super.onPause();
    }

    @Override
    public void onStop() {
        mBindingObjectStore.onStop();
        super.onStop();
    }

    @Override
    public void onDestroy() {
        mBindingObjectStore.onDestroy();
        super.onDestroy();
    }
}
