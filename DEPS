deps = {
  'crosswalk-extensions-sdk':
    'git@github.com:otcshare/crosswalk-extensions-sdk.git' + '@' + '430cd83ca2e417c731339e549e0a149e18d68240',
}

recursedeps = [
  'crosswalk-extensions-sdk',
]

hooks = [
  {
    "name": "gyp_realsense",
    "pattern": ".",
    "action": ["python", "src/gyp_realsense"],
  }
]
