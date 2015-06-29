deps = {
  'src/buildtools':
  'https://chromium.googlesource.com/chromium/buildtools.git' + '@' + '3b302fef93f7cc58d9b8168466905237484b2772',

  'src/crosswalk-extensions-sdk':
  'ssh://git@github.com/otcshare/crosswalk-extensions-sdk.git' + '@' + '430cd83ca2e417c731339e549e0a149e18d68240',
}

recursedeps = [
  'src/crosswalk-extensions-sdk',
]

hooks = [
  # Pull GN binaries.
  {
    'name': 'gn_win',
    'pattern': '.',
    'action': [ 'download_from_google_storage',
                '--no_resume',
                '--platform=win32',
                '--no_auth',
                '--bucket', 'chromium-gn',
                '-s', 'src/buildtools/win/gn.exe.sha1',
    ],
  },
  {
    'name': 'gn_linux64',
    'pattern': '.',
    'action': [ 'download_from_google_storage',
                '--no_resume',
                '--platform=linux*',
                '--no_auth',
                '--bucket', 'chromium-gn',
                '-s', 'src/buildtools/linux64/gn.sha1',
    ],
  },
  # TODO: Switch to GN later.
  {
    "name": "gyp_realsense",
    "pattern": ".",
    "action": ["python", "src/gyp_realsense"],
  }
]
