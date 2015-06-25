// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var callback_listeners = {};
var callback_id = 0;
var extension_object;
var internal = {};

function wrapCallback(args, callback) {
  if (callback) {
    var id = (callback_id++).toString();
    callback_listeners[id] = callback;
    args.unshift(id);
  } else {
    // The function name and the callback ID are prepended before
    // the arguments. If there is no callback, an empty string is
    // should be used. This will be sorted out by the InternalInstance
    // message handler.
    args.unshift("");
  }

  return id;
}

internal.setupInternalExtension = function(extension_obj) {
  if (extension_object != null)
    return;

  extension_object = extension_obj;

  extension_object.setMessageListener(function(msg) {
    var args = JSON.parse(msg);
    var id = args.shift();
    var listener = callback_listeners[id];

    if (listener !== undefined) {
      if (!listener.apply(null, args))
        delete callback_listeners[id];
    }
  });
};

internal.postMessage = function(function_name, args, callback) {
  var id = wrapCallback(args, callback);
  args.unshift(function_name);
  var msg = JSON.stringify(args);
  extension_object.postMessage(msg);

  return id;
};

internal.removeCallback = function(id) {
  if (!id in callback_listeners)
    return;

  delete callback_listeners[id];
};

var Common = function() {
  var v8tools = requireNative('v8tools');
  internal.setupInternalExtension(extension);

  var unique_id = 0;

  function getUniqueId() {
    return (unique_id++).toString();
  }

  function wrapPromiseAsCallback(promise) {
    return function(data, error) {
      if (error)
        promise.reject(error);
      else
        promise.fulfill(data);
    };
  };

  // The BindingObject is responsible for bridging between the JavaScript
  // implementation and the native code. It keeps a unique ID for each
  // instance of a given object that is used by the BindingObjectStore to
  // deliver messages.
  //
  // It also keeps track of when the instance gets collected by the Garbage
  // Collector, informing the native side that the native implementation can also
  // be freed.
  //
  // Creating a BindingObject with a predefined object ID in the constructor can
  // be used for having one or more JavaScript objects communicating with a native
  // object of the same ID, but only the original BindingObject that generated the
  // ID will have its lifecycle bound to the native object.
  //
  // _postMessage(function_name, arguments, callback):
  //     This method sends a message to the native counterpart of this
  //     object. It has the same signature of the Internal Extensions
  //     |postMessage| but wraps the unique identifier as the first argument
  //     automatically.
  //
  // _addMethod(name, has_callback):
  //     Convenience function for adding methods to an object that have a
  //     correspondent on the native side. Methods names that start with "_" are
  //     define as not enumerable by default. Set |has_callback| to true if the
  //     method expects a callback as the last parameter.
  //
  // _addMethodWithPromise(name, promise):
  //     Convenience function for adding methods that return a Promise. The reply
  //     from the native side is expected to have two parameters: |data| and
  //     |error|. If the |data| parameter is not empty, it will trigger a
  //     |reject()| and be passed as parameter to it, otherwise we |fullfill()|
  //     is invoked with |data|.
  //
  var BindingObjectPrototype = function() {
    function postMessage(name, args, callback) {
      return internal.postMessage("postMessageToObject",
          [this._id, name, args], callback);
    };

    function isEnumerable(method_name) {
      return name.indexOf("_") != 0;
    };

    function addMethod(name, has_callback) {
      Object.defineProperty(this, name, {
        value: function() {
          var args = Array.prototype.slice.call(arguments);

          var callback;
          if (has_callback)
            callback = args.pop();

          this._postMessage(name, args, callback);
        },
        enumerable: isEnumerable(name),
      });
    };

    function addMethodWithPromise(name, Promise) {
      Object.defineProperty(this, name, {
        value: function() {
          var promise_instance = new Promise();
          var args = Array.prototype.slice.call(arguments);
          this._postMessage(name, args, wrapPromiseAsCallback(promise_instance));
          return promise_instance;
        },
        enumerable: isEnumerable(name),
      });
    };

    function registerLifecycleTracker() {
      Object.defineProperty(this, "_tracker", {
        value: v8tools.lifecycleTracker(),
      });

      var object_id = this._id;
      this._tracker.destructor = function() {
        internal.postMessage("JSObjectCollected", [object_id]);
      };
    }

    Object.defineProperties(this, {
      "_postMessage" : {
        value: postMessage,
      },
      "_addMethod" : {
        value: addMethod,
      },
      "_addMethodWithPromise" : {
        value: addMethodWithPromise,
      },
      "_registerLifecycleTracker" : {
        value: registerLifecycleTracker,
      },
    });
  };

  var BindingObject = function(object_id) {
    Object.defineProperties(this, {
      "_id": {
        value: object_id,
      },
    });
  };

  // This class implements the W3C EventTarget interface and also offers
  // convenience methods for declaring events. The native implementation class is
  // expected to inherit from realsense::common::EventTarget.
  //
  // The following interface will be always publicly available for every object
  // using this prototype and they behave just like the specified:
  //
  // addEventListener(type, listener)
  // removeEventListener(type, listener)
  // dispatchEvent(event)
  //
  // The following method is available for internal usage only:
  //
  // _addEvent(event_name, EventSynthesizer?):
  //     Convenience function for declaring the events available for the
  //     EventTarget. It will also declare a functional on[type] EventHandler.
  //     The optional EventSynthesizer, if supplied, will be used for create
  //     the event, if not supplied, a default MessageEvent is created (the data
  //     is simply associated to event.data).
  //
  // Important considerations:
  //    - Objects with message listeners attached are never going to be collected
  //      by the garbage collector (which is fine and expected).
  //    - That said, an object listening for its own events is going to leak. It
  //      can be solved by creating a proxy object (see TCPSocket).
  //
  var EventTargetPrototype = function() {
    var DefaultEvent = function(type, data) {
      this.type = type;

      if (data)
        this.data = data;
    };

    function addEvent(type, event) {
      Object.defineProperty(this, "_on" + type, {
        writable : true,
      });

      Object.defineProperty(this, "on" + type, {
        get: function() {
          return this["_on" + type];
        },
        set: function(listener) {
          var old_listener = this["_on" + type];
          if (old_listener === listener)
            return;

          if (old_listener)
            this.removeEventListener(type, old_listener);

          this["_on" + type] = listener;
          this.addEventListener(type, listener);
        },
        enumerable: true,
      });

      if (event)
        this._event_synthesizers[type] = event;
      else
        this._event_synthesizers[type] = DefaultEvent;
    };

    function dispatchEvent(event) {
      if (!event.type)
        return;
      if (!(event.type in this._event_listeners))
        return;

      var listeners = this._event_listeners[event.type];
      for (var i in listeners)
        listeners[i](event);
    };

    function dispatchEventFromExtension(type, data) {
      var listeners = this._event_listeners[type];

      for (var i in listeners)
        listeners[i](new this._event_synthesizers[type](type, data));
    };

    // We need a reference to the calling object because
    // this function is called by the renderer process with
    // "this" equals to the global object.
    function makeCallbackListener(obj, type) {
      return function(data) {
        obj._dispatchEventFromExtension(type, data);
        return true;
      };
    };

    function addEventListener(type, listener) {
      if (!(listener instanceof Function))
        return;

      if (!(("on" + type) in this))
        return;

      if (type in this._event_listeners) {
        var listeners = this._event_listeners[type];
        if (listeners.indexOf(listener) == -1)
          listeners.push(listener);
      } else {
        this._event_listeners[type] = [listener];
        var id = this._postMessage("addEventListener",
            [type], makeCallbackListener(this, type));
        this._callback_listeners_id[type] = id;
      }
    };

    function removeEventListener(type, listener) {
      if (!(listener instanceof Function))
        return;

      if (!(type in this._event_listeners))
        return;

      var listeners = this._event_listeners[type];
      var index = listeners.indexOf(listener);
      if (index == -1)
        return;

      if (listeners.length == 1) {
        internal.removeCallback(this._callback_listeners_id[type]);
        delete this._event_listeners[type];
        delete this._callback_listeners_id[type];
        this._postMessage("removeEventListener", [type]);
      } else {
        listeners.splice(index, 1);
      }
    };

    Object.defineProperties(this, {
      "_addEvent" : {
        value : addEvent,
      },
      "_dispatchEventFromExtension" : {
        value : dispatchEventFromExtension,
      },
      "addEventListener" : {
        value : addEventListener,
        enumerable : true,
      },
      "removeEventListener" : {
        value : removeEventListener,
        enumerable : true,
      },
      "dispatchEvent" : {
        value : dispatchEvent,
        enumerable : true,
      },
    });
  };

  var EventTarget = function(object_id) {
    Object.defineProperties(this, {
      "_event_listeners": {
        value: {},
      },
      "_callback_listeners_id": {
        value: {},
      },
      "_event_synthesizers": {
        value: {},
      },
    });
  };

  EventTargetPrototype.prototype = new BindingObjectPrototype();

  Object.defineProperties(this, {
    'getUniqueId': {
      value: getUniqueId,
      enumerable: true
    },
    'BindingObjectPrototype': {
      value: BindingObjectPrototype,
      enumerable: true
    },
    'BindingObject': {
      value: BindingObject,
      enumerable: true
    },
    'EventTargetPrototype': {
      value: EventTargetPrototype,
      enumerable: true
    },
    'EventTarget': {
      value: EventTarget,
      enumerable: true
    }
  });
};

var common = new Common();
