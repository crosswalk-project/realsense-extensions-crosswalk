vars = {
  'chromium_git': 'https://chromium.googlesource.com',
}

deps = {
  'src/testing/gmock':
  Var('chromium_git') + '/external/googlemock.git' + '@' + '29763965ab52f24565299976b936d1265cb6a271',

  'src/testing/gtest':
  Var('chromium_git') + '/external/googletest.git' + '@' + 'be1868139ffe0ccd0e8e3b37292b84c821d9c8ad',

  'src/third_party/icu':
  Var('chromium_git') + '/chromium/deps/icu.git' + '@' + 'e4c31439828d356525b71ef81a6d61ea50d7d673',

  'src/tools/gyp':
  Var('chromium_git') + '/external/gyp.git' + '@' + '2889664b9fa88cce175c5c7cdf207d28420a7412',
}

hooks = [
  {
    "name": "gyp_realsense",
    "pattern": ".",
    "action": ["python", "src/gyp_realsense"],
  }
]
