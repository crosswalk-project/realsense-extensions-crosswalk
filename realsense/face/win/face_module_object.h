// Copyright 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_FACE_WIN_FACE_MODULE_OBJECT_H_
#define REALSENSE_FACE_WIN_FACE_MODULE_OBJECT_H_

#include <string>

#include "base/message_loop/message_loop_proxy.h"
#include "base/threading/thread.h"
#include "third_party/libpxc/include/pxcfacedata.h"
#include "third_party/libpxc/include/pxcimage.h"
#include "third_party/libpxc/include/pxcsensemanager.h"
#include "xwalk/common/event_target.h"

namespace realsense {
namespace face {

class FaceModuleObject : public xwalk::common::EventTarget {
 public:
  FaceModuleObject();
  ~FaceModuleObject() override;

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
  void OnSetConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetDefaultsConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnRegisterUserByFaceID(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnUnregisterUserByID(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  // Run on face_module_thread_
  void OnStartPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnRunPipeline();
  void OnStopPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetProcessedSampleOnPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnRegisterUserByFaceIDOnPipeline(
      int faceId,
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnUnregisterUserByIDOnPipeline(
      int userId,
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  // Run on face_ext_thread_ or face_module_thread_
  void DoSetConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void DoGetDefaultsConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void DoGetConf(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  // Run on face extension thread
  bool Init();
  void Destroy();

  // Run on face_module_thread_
  bool CreateProcessedSampleImages();
  void ReleasePipelineResources();

  // Run on face_module_thread_
  void StopFaceModuleThread();
  // Run on face extension thread
  void OnStopFaceModuleThread();

  size_t CalculateBinaryMessageSize();

  enum State {
    NOT_READY,
    IDLE,
    TRACKING,
  };
  State state_;

  bool on_processedsample_;
  bool on_error_;

  base::Thread face_module_thread_;
  scoped_refptr<base::MessageLoopProxy> message_loop_;

  PXCSession* session_;
  PXCSenseManager* sense_manager_;
  PXCFaceData* face_output_;
  PXCFaceConfiguration* face_config_;

  PXCImage* latest_color_image_;
  PXCImage* latest_depth_image_;

  scoped_ptr<uint8[]> binary_message_;
  size_t binary_message_size_;
};

}  // namespace face
}  // namespace realsense

#endif  // REALSENSE_FACE_WIN_FACE_MODULE_OBJECT_H_
