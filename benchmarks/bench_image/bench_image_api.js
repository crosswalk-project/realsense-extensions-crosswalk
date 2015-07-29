// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

var BenchImage = function(object_id) {
  common.BindingObject.call(this, common.getUniqueId());

  if (object_id == undefined)
    internal.postMessage('benchImageConstructor', [this._id]);

  this._addMethodWithPromise('getSampleLong', Promise);
  this._addMethodWithPromise('getSampleString', Promise);
};

BenchImage.prototype = new common.EventTargetPrototype();
BenchImage.prototype.constructor = BenchImage;

exports = new BenchImage;
