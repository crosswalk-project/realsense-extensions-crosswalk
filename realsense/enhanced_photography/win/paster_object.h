// Copyright 2015 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef REALSENSE_ENHANCED_PHOTOGRAPHY_WIN_PASTER_OBJECT_H_
#define REALSENSE_ENHANCED_PHOTOGRAPHY_WIN_PASTER_OBJECT_H_

#include <string>
#include <vector>

// This file is auto-generated by paster.idl
#include "paster.h" // NOLINT

#include "realsense/enhanced_photography/win/enhanced_photography_instance.h"
#include "third_party/libpxc/include/pxcenhancedphoto.h"
#include "third_party/libpxc/include/pxcimage.h"
#include "third_party/libpxc/include/pxcsession.h"
#include "third_party/libpxc/include/pxcphoto.h"

namespace realsense {
namespace enhanced_photography {

using xwalk::common::XWalkExtensionFunctionInfo;
using namespace jsapi::paster; // NOLINT

class PasterObject : public xwalk::common::BindingObject {
 public:
  explicit PasterObject(EnhancedPhotographyInstance* instance,
                        PXCPhoto* photo);
  ~PasterObject() override;

 private:
  void OnGetPlanesMap(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnSetSticker(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnPaste(scoped_ptr<XWalkExtensionFunctionInfo> info);
  void OnPreviewSticker(scoped_ptr<XWalkExtensionFunctionInfo> info);

  EnhancedPhotographyInstance* instance_;
  PXCSession* session_;
  PXCEnhancedPhoto::Paster* paster_;
  PXCPhoto* photo_;
  std::vector<PXCImage::ImageData> sticker_data_set_;
  scoped_ptr<uint8[]> binary_message_;
  size_t binary_message_size_;
};

}  // namespace enhanced_photography
}  // namespace realsense

#endif  // REALSENSE_ENHANCED_PHOTOGRAPHY_WIN_PASTER_OBJECT_H_
