{
  'targets': [
    {
      'target_name': 'xw_extension',
      'type': 'static_library',
      'includes': [
        'xwalk_js2c.gypi',
      ],
      'sources': [
        'extension.cc',
        'extension.h',
        'picojson.h',
        'utils.h',
        'XW_Extension.h',
        'XW_Extension_EntryPoints.h',
        'XW_Extension_Permissions.h',
        'XW_Extension_Runtime.h',
        'XW_Extension_SyncMessage.h',
      ],
    }
  ]
}