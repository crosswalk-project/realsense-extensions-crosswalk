// Copyright 2016 Intel Corporation. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.


#include "realsense/common/win/common_utils.h"

namespace realsense {
namespace common {

scoped_ptr<base::ListValue> CreateDOMException(const std::string& message,
                                               ErrorName name) {
  DOMException domException;
  domException.message = message;
  domException.name = name;

  scoped_ptr<base::ListValue> result(new base::ListValue());
  result->Append(base::Value::CreateNullValue());
  result->Append((domException).ToValue().release());
  return result.Pass();
}

scoped_ptr<base::ListValue> CreateSuccessResult() {
  scoped_ptr<base::ListValue> create_results(new base::ListValue());
  create_results->Append(base::Value::CreateNullValue());
  return create_results.Pass();
}

void GetBinaryValueFromArgs(
    base::ListValue* args, base::BinaryValue** value) {
  base::Value* buffer_value = NULL;
  if (args->Get(0, &buffer_value) &&
      !buffer_value->IsType(base::Value::TYPE_NULL)) {
    if (buffer_value->IsType(base::Value::TYPE_BINARY)) {
      *value = static_cast<base::BinaryValue*>(buffer_value);
    }
  }
}

}  // namespace common
}  // namespace realsense
