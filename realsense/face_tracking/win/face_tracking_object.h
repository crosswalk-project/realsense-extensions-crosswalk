// Copyright 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_FACE_TRACKING_FACE_TRACKING_OBJECT_H_
#define REALSENSE_FACE_TRACKING_FACE_TRACKING_OBJECT_H_

#include <string>

#include "pxcfacedata.h" //NOLINT
#include "pxcimage.h" //NOLINT
#include "pxcsensemanager.h"  // NOLINT

#include "base/message_loop/message_loop_proxy.h"
#include "base/threading/thread.h"
#include "xwalk/common/event_target.h"

namespace realsense {
namespace face_tracking {

class FaceTrackingObject : public xwalk::common::EventTarget {
 public:
  FaceTrackingObject();
  ~FaceTrackingObject() override;

  // EventTarget implementation.
  void StartEvent(const std::string& type) override;
  void StopEvent(const std::string& type) override;

 private:
  void OnStart(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnStop(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetProcessedSample(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  // Run on face_tracking_thread_
  void OnCreateAndStartPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnRunPipeline();
  void OnStopAndDestroyPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetProcessedSampleOnPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  bool CreateSessionInstance();
  void DestroySessionInstance();

  // Run on face_tracking_thread_
  bool CreateProcessedSampleImages();
  void ReleaseResources();

  // Run on face_tracking_thread_
  void StopFaceTrackingThread();
  // Run on face extension thread
  void OnStopFaceTrackingThread();

  size_t CalculateBinaryMessageSize();

  enum State {
    IDLE,
    TRACKING,
  };
  State state_;

  bool on_processedsample_;
  bool on_error_;

  base::Thread face_tracking_thread_;
  scoped_refptr<base::MessageLoopProxy> message_loop_;

  PXCSession* session_;
  PXCSenseManager* sense_manager_;
  PXCFaceData* face_output_;

  PXCImage* latest_color_image_;
  PXCImage* latest_depth_image_;
  bool detection_enabled_;
  bool landmark_enabled_;
  int num_of_landmark_points_;

  scoped_ptr<uint8[]> binary_message_;
  size_t binary_message_size_;
};

}  // namespace face_tracking
}  // namespace realsense

#endif  // REALSENSE_FACE_TRACKING_FACE_TRACKING_OBJECT_H_
