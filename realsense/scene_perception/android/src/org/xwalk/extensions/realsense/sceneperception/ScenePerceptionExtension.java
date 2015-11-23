// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

package org.xwalk.extensions.realsense.scenePerception;

import android.app.Activity;
import android.util.Log;

import org.xwalk.app.runtime.extension.XWalkExtensionClient;
import org.xwalk.app.runtime.extension.XWalkExtensionContextClient;
import org.xwalk.extensions.common.*;

public class ScenePerceptionExtension extends XWalkExtensionClient {
    private static final String TAG = "ScenePerceptionExtension";
    protected XWalkExtensionContextClient mExtensionContextClient = null;
    private BindingObjectStore mBindingObjectStore;
    private FunctionHandler mHandler;

    public ScenePerceptionExtension(
            String name, String jsApiContent, XWalkExtensionContextClient xwalkContext) {
        super(name, jsApiContent, xwalkContext);
        mExtensionContextClient = xwalkContext;
        mHandler = new FunctionHandler();
        mBindingObjectStore = new BindingObjectStore(mHandler);

        mHandler.register("scenePerceptionConstructor", this);
    }

    private void handleMessage(int instanceID, String message) {
        FunctionInfo info = new FunctionInfo(this, instanceID, message);
        mHandler.handleFunction(info);
    }

    public void onScenePerceptionConstructor(FunctionInfo info) {
        ScenePerceptionObject ep = new ScenePerceptionObject(mExtensionContextClient);
        mBindingObjectStore.addBindingObject(info.getObjectId(), ep);
    }

    @Override
    public void onMessage(int instanceID, String message) {
        if (!message.isEmpty()) handleMessage(instanceID, message);
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