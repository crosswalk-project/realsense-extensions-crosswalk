recursion = 1
use_relative_paths = True

deps_os = {
  'win': {
    'third_party/libpxc': 'https://github.com/crosswalk-project/libpxc.git@568e4ecc969b4663e82034e71d08efdd5fa77e1a',
  },
}

hooks = [
  {
    # Update bower_components(Polymer custome elements) needed by sample app.
    'name': 'sample_bower_update',
    'pattern': '.',
    'action': ['python', 'src/extensions/sample/sample_bower_update.py'],
  },
]
