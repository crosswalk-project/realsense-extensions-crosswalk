// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var g_next_async_call_id = 0;
var g_async_calls = [];
var g_listeners = [];

var g_next_listener_id = 0;

function AsyncCall(resolve, reject) {
  this.resolve = resolve;
  this.reject = reject;
}

function createPromise(msg, customAsyncCall) {
  var promise = new Promise(function(resolve, reject) {
    if (typeof customAsyncCall == 'undefined')
      g_async_calls[g_next_async_call_id] = new AsyncCall(resolve, reject);
    else
      g_async_calls[g_next_async_call_id] = new customAsyncCall(resolve, reject);
  });
  msg.asyncCallId = g_next_async_call_id;
  extension.postMessage(JSON.stringify(msg));
  ++g_next_async_call_id;
  return promise;
}

exports.startPreview = function() {
  var msg = {
    'cmd': 'startPreview'
  };
  return createPromise(msg);
};

exports.stopPreview = function() {
  var msg = {
    'cmd': 'stopPreview'
  };
  return createPromise(msg);
};

exports.getPreviewImage = function() {
  var msg = {
    'cmd': 'getPreviewImage'
  };
  function wrapReturns(resolve, reject) {
    this.resolve = function(buffer) {
      var int32Array = new Int32Array(buffer, 0, 12);
      var width = int32Array[1];
      var height = int32Array[2];
      var data = new Uint8Array(buffer, 12);
      resolve({format: 'RGB32', width: width, height: height, data: data});
    }
    this.reject = reject;
  }
  return createPromise(msg, wrapReturns);
}

extension.setMessageListener(function(buffer) {
  if (buffer instanceof ArrayBuffer) {
    var int32Array = new Int32Array(buffer, 0, 4);
    var asyncCallId = int32Array[0];
    g_async_calls[asyncCallId].resolve(buffer);
    delete g_async_calls[asyncCallId];
  } else {
    var msg = JSON.parse(buffer);
    if (msg.event) {
      exports[msg.event]();
    } else if (msg.data.error) {
      g_async_calls[msg.asyncCallId].reject(msg.data.error);
    } else {
      g_async_calls[msg.asyncCallId].resolve(msg.data); 
    }

    delete g_async_calls[msg.asyncCallId];
  }
});
