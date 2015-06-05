{
  'target_defaults': {
    'variables': {
      # See http://msdn.microsoft.com/en-us/library/aa652360(VS.71).aspx
      'win_release_Optimization%': '2', # 2 = /Os
      'win_debug_Optimization%': '0',   # 0 = /Od

      # See http://msdn.microsoft.com/en-us/library/2kxx5t2c(v=vs.80).aspx
      # Tri-state: blank is default, 1 on, 0 off
      'win_release_OmitFramePointers%': '0',
      # Tri-state: blank is default, 1 on, 0 off
      'win_debug_OmitFramePointers%': '',

      # See http://msdn.microsoft.com/en-us/library/8wtf2dfz(VS.71).aspx
      'win_debug_RuntimeChecks%': '3',    # 3 = all checks enabled, 0 = off

      # See http://msdn.microsoft.com/en-us/library/47238hez(VS.71).aspx
      'win_debug_InlineFunctionExpansion%': '',    # empty = default, 0 = off,
      'win_release_InlineFunctionExpansion%': '2', # 1 = only __inline, 2 = max

      # VS inserts quite a lot of extra checks to algorithms like
      # std::partial_sort in Debug build which make them O(N^2)
      # instead of O(N*logN). This is particularly slow under memory
      # tools like ThreadSanitizer so we want it to be disablable.
      # See http://msdn.microsoft.com/en-us/library/aa985982(v=VS.80).aspx
      'win_debug_disable_iterator_debugging%': '0',

      'release_extra_cflags%': '',
      'debug_extra_cflags%': '',

      # the non-qualified versions are widely assumed to be *nix-only
      'win_release_extra_cflags%': '',
      'win_debug_extra_cflags%': '',

      # See http://msdn.microsoft.com/en-us/library/aa652367.aspx
      'win_release_RuntimeLibrary%': '2', # 2 = /MD (nondebug DLL)
      'win_debug_RuntimeLibrary%': '3',   # 3 = /MDd (debug DLL)

      # TODO(sgk): eliminate this if possible.
      # It would be nicer to support this via a setting in 'target_defaults'
      # in chrome/app/locales/locales.gypi overriding the setting in the
      # 'Debug' configuration in the 'target_defaults' dict below,
      # but that doesn't work as we'd like.
      'msvs_debug_link_incremental%': '2',

      # Needed for some of the largest modules.
      'msvs_debug_link_nonincremental%': '1',
    },
    'msvs_cygwin_dirs': ['<(DEPTH)/third_party/cygwin'],
    'default_configuration': 'Debug',
    'msvs_disabled_warnings': [4351, 4355, 4396, 4503, 4819,
      # TODO(maruel): These warnings are level 4. They will be slowly
      # removed as code is fixed.
      4100, 4121, 4125, 4127, 4130, 4131, 4189, 4201, 4238, 4244, 4245,
      4310, 4428, 4481, 4505, 4510, 4512, 4530, 4610, 4611, 4701, 4702,
      4706,
    ],
    'msvs_configuration_attributes': {
      'OutputDirectory': '<(DEPTH)\\build\\$(ConfigurationName)',
      'IntermediateDirectory': '$(OutDir)\\obj\\$(ProjectName)',
      'CharacterSet': '1',
    },
    'msvs_settings': {
      'VCCLCompilerTool': {
        'AdditionalOptions': ['/MP'],
        'MinimalRebuild': 'false',
        'BufferSecurityCheck': 'true',
        'EnableFunctionLevelLinking': 'true',
        'RuntimeTypeInfo': 'false',
        'WarningLevel': '4',
        'WarnAsError': 'true',
        'DebugInformationFormat': '3',
        'ExceptionHandling': '0',
        'PreprocessorDefinitions': ['WIN32'],
        'WarnAsError': 'false',
      },
      'VCLibrarianTool': {
        'AdditionalOptions': ['/ignore:4221'],
        'AdditionalLibraryDirectories': [
          '',
        ],
      },

      'VCLinkerTool': {
        'AdditionalDependencies': [
        ],
        'AdditionalLibraryDirectories': [
          '',
        ],
        'GenerateDebugInformation': 'true',
        'MapFileName': '$(OutDir)\\$(TargetName).map',
        'ImportLibrary': '$(OutDir)\\lib\\$(TargetName).lib',
        'FixedBaseAddress': '1',
        # SubSystem values:
        #   0 == not set
        #   1 == /SUBSYSTEM:CONSOLE
        #   2 == /SUBSYSTEM:WINDOWS
        # Most of the executables we'll ever create are tests
        # and utilities with console output.
        'SubSystem': '1',
      },
      'VCMIDLTool': {
        'GenerateStublessProxies': 'true',
        'TypeLibraryName': '$(InputName).tlb',
        'OutputDirectory': '$(IntDir)',
        'HeaderFileName': '$(InputName).h',
        'DLLDataFileName': '$(InputName).dlldata.c',
        'InterfaceIdentifierFileName': '$(InputName)_i.c',
        'ProxyFileName': '$(InputName)_p.c',
      },
      'VCResourceCompilerTool': {
        'Culture' : '1033',
        'AdditionalIncludeDirectories': [
          '<(DEPTH)',
          '<(SHARED_INTERMEDIATE_DIR)',
        ],
      },
    },
    'configurations': {
      'Debug': {
        'msvs_settings': {
          'VCCLCompilerTool': {
            'Optimization': '<(win_debug_Optimization)',
            'PreprocessorDefinitions': ['_DEBUG'],
            'BasicRuntimeChecks': '<(win_debug_RuntimeChecks)',
            'RuntimeLibrary': '<(win_debug_RuntimeLibrary)',
            'conditions': [
              # According to MSVS, InlineFunctionExpansion=0 means
              # "default inlining", not "/Ob0".
              # Thus, we have to handle InlineFunctionExpansion==0 separately.
              ['win_debug_InlineFunctionExpansion==0', {
                'AdditionalOptions': ['/Ob0'],
              }],
              ['win_debug_InlineFunctionExpansion!=""', {
                'InlineFunctionExpansion':
                  '<(win_debug_InlineFunctionExpansion)',
              }],
              ['win_debug_disable_iterator_debugging==1', {
                'PreprocessorDefinitions': ['_HAS_ITERATOR_DEBUGGING=0'],
              }],

              # if win_debug_OmitFramePointers is blank, leave as default
              ['win_debug_OmitFramePointers==1', {
                'OmitFramePointers': 'true',
              }],
              ['win_debug_OmitFramePointers==0', {
                'OmitFramePointers': 'false',
                # The above is not sufficient (http://crbug.com/106711): it
                # simply eliminates an explicit "/Oy", but both /O2 and /Ox
                # perform FPO regardless, so we must explicitly disable.
                # We still want the false setting above to avoid having
                # "/Oy /Oy-" and warnings about overriding.
                'AdditionalOptions': ['/Oy-'],
              }],
            ],
            'AdditionalOptions': [ '<@(win_debug_extra_cflags)', ],
          },
          'VCLinkerTool': {
            'LinkIncremental': '<(msvs_debug_link_incremental)',
            # ASLR makes debugging with windbg difficult because Chrome.exe and
            # Chrome.dll share the same base name. As result, windbg will
            # name the Chrome.dll module like chrome_<base address>, where
            # <base address> typically changes with each launch. This in turn
            # means that breakpoints in Chrome.dll don't stick from one launch
            # to the next. For this reason, we turn ASLR off in debug builds.
            # Note that this is a three-way bool, where 0 means to pick up
            # the default setting, 1 is off and 2 is on.
            'RandomizedBaseAddress': 1,
          },
          'VCResourceCompilerTool': {
            'PreprocessorDefinitions': ['_DEBUG'],
          },
        },
      },  # Debug
      'Release': {
        'msvs_settings': {
          'VCCLCompilerTool': {
            'RuntimeLibrary': '<(win_release_RuntimeLibrary)',
            'Optimization': '<(win_release_Optimization)',
            'conditions': [
              # According to MSVS, InlineFunctionExpansion=0 means
              # "default inlining", not "/Ob0".
              # Thus, we have to handle InlineFunctionExpansion==0 separately.
              ['win_release_InlineFunctionExpansion==0', {
                'AdditionalOptions': ['/Ob0'],
              }],
              ['win_release_InlineFunctionExpansion!=""', {
                'InlineFunctionExpansion':
                  '<(win_release_InlineFunctionExpansion)',
              }],

              # if win_release_OmitFramePointers is blank, leave as default
              ['win_release_OmitFramePointers==1', {
                'OmitFramePointers': 'true',
              }],
              ['win_release_OmitFramePointers==0', {
                'OmitFramePointers': 'false',
                # The above is not sufficient (http://crbug.com/106711): it
                # simply eliminates an explicit "/Oy", but both /O2 and /Ox
                # perform FPO regardless, so we must explicitly disable.
                # We still want the false setting above to avoid having
                # "/Oy /Oy-" and warnings about overriding.
                'AdditionalOptions': ['/Oy-'],
              }],
            ],
            'AdditionalOptions': [ '<@(win_release_extra_cflags)', ],
          },
          'VCLinkerTool': {
            # LinkIncremental is a tri-state boolean, where 0 means default
            # (i.e., inherit from parent solution), 1 means false, and
            # 2 means true.
            'LinkIncremental': '1',
            # This corresponds to the /PROFILE flag which ensures the PDB
            # file contains FIXUP information (growing the PDB file by about
            # 5%) but does not otherwise alter the output binary. This
            # information is used by the Syzygy optimization tool when
            # decomposing the release image.
            'Profile': 'true',
          },
        },
      },  # Release
    }, # configurations
    'include_dirs': [
      '<(DEPTH)',
      '<(DEPTH)/src',
      '<(SHARED_INTERMEDIATE_DIR)',
    ],
  },
}
