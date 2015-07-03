// Copyright (c) 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_OBJECT_H_
#define REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_OBJECT_H_

#include <string>

#include "pxcsensemanager.h"  // NOLINT
#include "pxcsceneperception.h" // NOLINT

#include "base/message_loop/message_loop_proxy.h"
#include "base/time/time.h"
#include "base/threading/thread.h"
#include "xwalk/common/event_target.h"

namespace realsense {
namespace scene_perception {

class ScenePerceptionObject : public xwalk::common::EventTarget {
 public:
  ScenePerceptionObject();
  ~ScenePerceptionObject() override;

  // EventTarget implementation.
  void StartEvent(const std::string& type) override;
  void StopEvent(const std::string& type) override;

 private:
  void OnStart(scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnStop(scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnReset(scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnEnableTracking(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnDisableTracking(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnEnableMeshing(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnDisableMeshing(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnGetSample(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  // Run on scenemanager_thread_
  void OnCreateAndStartPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnStopAndDestroyPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnRunPipeline();
  void OnResetScenePerception(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnPauseScenePerception(
      bool pause,
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnEnableReconstruction(
      bool enable,
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnCopySample(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);
  void OnMeshingResult();
  void ReleaseResources();

  // Run on meshing_thread_
  void OnDoMeshingUpdate();

  void StopSceneManagerThread();
  // Run on extension thread
  void OnStopSceneManagerThread();

 private:
  enum State {
    IDLE,
    CHECKING,
    TRACKING,
    MESHING,
  };
  State state_;

  bool on_sample_;
  bool on_checking_;
  bool on_tracking_;
  bool on_meshing_;

  bool doing_meshing_updating_;
  base::Thread scenemanager_thread_;
  base::Thread meshing_thread_;
  scoped_refptr<base::MessageLoopProxy> message_loop_;

  int color_image_width_;
  int color_image_height_;
  float color_capture_framerate_;
  int depth_image_width_;
  int depth_image_height_;
  float depth_capture_framerate_;

  base::TimeTicks last_meshing_time_;

  PXCSession* session_;
  PXCSenseManager* scene_manager_;
  PXCScenePerception* scene_perception_;

  PXCBlockMeshingData* block_meshing_data_;
  PXCScenePerception::MeshingUpdateInfo  meshing_update_info_;

  PXCImage* latest_color_image_;
  PXCImage* latest_depth_image_;
};

}  // namespace scene_perception
}  // namespace realsense

#endif  // REALSENSE_SCENE_PERCEPTION_SCENE_PERCEPTION_OBJECT_H_
