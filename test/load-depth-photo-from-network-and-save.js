// Copyright (c) 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Tests checking that realsense.DepthEnabledPhotography module supports
// XDMUtils interface to check, load and save XDM data, via loading
// a depth photo from network.
// interface XDMUtils {
//     static Promise<boolean> isXDM (Blob blob);
//     static Promise<Photo>   loadXDM (Blob blob);
//     static Promise<Blob>    saveXDM (Photo photo);
// };

test(function() {
  assert_own_property(realsense, 'DepthEnabledPhotography',
      'realsense.DepthEnabledPhotography module is not supported');
  assert_equals(typeof realsense.DepthEnabledPhotography, 'object');

  assert_own_property(realsense.DepthEnabledPhotography, 'XDMUtils');
  var xdmUtils = realsense.DepthEnabledPhotography.XDMUtils;
  assert_equals(typeof xdmUtils, 'object');


  var methods = [
    ['isXDM', typeof xdmUtils.isXDM, 'function'],
    ['loadXDM', typeof xdmUtils.loadXDM, 'function'],
    ['saveXDM', typeof xdmUtils.saveXDM, 'function']
  ];

  methods.forEach(function(item) {
    test(function() {
      assert_own_property(xdmUtils, item[0]);
      assert_equals(item[1], item[2]);
    }, 'Check that XDMUtils interface supports method ' + item[0] + '()');
  });

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.isXDM());
  }, 'Check that XDMUtils.isXDM() throws TypeError');

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.isXDM(null));
  }, 'Check that XDMUtils.isXDM(null) throws TypeError');

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.loadXDM());
  }, 'Check that XDMUtils.loadXDM() throws TypeError');

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.loadXDM(null));
  }, 'Check that XDMUtils.loadXDM(null) throws TypeError');

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.saveXDM());
  }, 'Check that XDMUtils.saveXDM() throws TypeError');

  promise_test(function(t) {
    return promise_rejects(t, new TypeError(), xdmUtils.saveXDM(null));
  }, 'Check that XDMUtils.saveXDM(null) throws TypeError');


  promise_test(function(t) {
    return xdmUtils.isXDM(new Blob(['TEST']))
        .then(function(success) {
          assert_false(success);
        })
        .catch(function(e) {
          assert_unreached(e.message);
        });
  }, "Check that XDMUtils.isXDM() returns false if blob data isn't in XDM format");


  async_test(function(t) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'resources/depthphoto.jpg', true);
    xhr.responseType = 'blob';
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4 && xhr.status == 200) {
        var blob = xhr.response;
        xdmUtils.isXDM(blob)
            .then(function(success) {
              assert_true(success);
              return xdmUtils.loadXDM(blob);
            })
            .then(function(photo) {
              check_photo(photo);
              return xdmUtils.saveXDM(photo);
            })
            .then(function(blob2) {
              assert_equals(blob2.size, blob.size);
              assert_equals(blob2.type, blob.type);
              t.done();
            })
            .catch(function(e) {
              assert_unreached(e.message);
            });
      }
    };
    xhr.send();
  }, 'Check that XDMUtils interface is able to check, load and save XDM data' +
      'via loading a depth photo from network', {timeout: 60000});

  // Check the Photo interface with photo data loaded by XDMUtils.loadXDM(blob)
  function check_photo(photo) {
    assert_true(photo instanceof Photo, 'photo is not an instance of Photo');
  };
}, 'Check that realsense.DepthEnabledPhotography module supports XDMUtils interface');
