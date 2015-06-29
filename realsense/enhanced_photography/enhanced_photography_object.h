// Copyright 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_OBJECT_H_
#define REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_OBJECT_H_

#include <string>

#include "base/message_loop/message_loop_proxy.h"
#include "base/synchronization/lock.h"
#include "base/threading/thread.h"
#include "xwalk/common/event_target.h"
#include "xwlak/enhanced_photography/enhanced_photography.h"

#include "pxcenhancedphotography.h" //NOLINT
#include "pxcphoto.h" // NOLINT
#include "pxcsensemanager.h"  // NOLINT

namespace realsense {
namespace enhanced_photography {

using xwalk::common::XWalkExtensionFunctionInfo;
using namespace jsapi::enhanced_photography; // NOLINT

class EnhancedPhotographyObject : public xwalk::common::EventTarget {
 public:
  EnhancedPhotographyObject();
  ~EnhancedPhotographyObject() override;

  // EventTarget implementation.
  void StartEvent(const std::string& type) override;
  void StopEvent(const std::string& type) override;

 private:
  void OnStartPreview(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnStopPreview(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnGetPreviewImage(scoped_ptr<XWalkExtensionFunctionInfo> info);

  // This method will capture a photo from preview and bind it with |photo_|
  void OnTakeSnapShot(scoped_ptr<XWalkExtensionFunctionInfo> info);

  // This method will bind the XMP photo with |photo_|.
  void OnLoadFromXMP(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnSaveAsXMP(scoped_ptr<XWalkExtensionFunctionInfo> info);

  void OnMeasureDistance(scoped_ptr<XWalkExtensionFunctionInfo> info);

  bool CreateSessionInstance();
  bool CreateEPInstance();
  void DispatchPicture(PXCImage* image);
  bool CopyImage(PXCImage* pxcimage, Image* image);
  void ReleaseMainResources();
  void ReleasePreviewResources();

  // Run on ep_preview_thread_
  void OnEnhancedPhotoPreviewPipeline();
  void OnStopAndDestroyPipeline(
      scoped_ptr<xwalk::common::XWalkExtensionFunctionInfo> info);

  enum State {
    IDLE,
    PREVIEW,
  };
  State state_;

  bool on_image_;
  bool on_preview_;
  bool is_snapshot_;

  base::Lock lock_;
  base::Thread ep_preview_thread_;
  scoped_refptr<base::MessageLoopProxy> message_loop_;

  PXCSession* session_;
  PXCSenseManager* sense_manager_;
  PXCEnhancedPhotography* ep_;
  PXCPhoto* photo_;
  PXCImage* preview_image_;
};

}  // namespace enhanced_photography
}  // namespace realsense

#endif  // REALSENSE_ENHANCED_PHOTOGRAPHY_ENHANCED_PHOTOGRAPHY_OBJECT_H_
