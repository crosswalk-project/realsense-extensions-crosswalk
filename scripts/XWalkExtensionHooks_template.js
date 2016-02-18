// MODULE_NAME will be defined here.
var child_process = require('child_process');
var fs = require('fs');
var OS = require('os');
var Path = require('path');

var RS_RUNTIME_URL_BASE =
    'http://registrationcenter-download.intel.com/akdlm/irc_nas/8516/';
var RS_RUNTIME_URL = RS_RUNTIME_URL_BASE +
    'intel_rs_sdk_runtime_websetup_8.0.24.6528.exe';
var RS_LICENSE_URL = RS_RUNTIME_URL_BASE +
    'Intel%20RealSense%20SDK%20RT%20EULA.rtf';
var FeatureNameMap = {
  'RS_R200_DEP': 'epv',
  'RS_R200_SP': 'scene_perception',
  'RS_R200_Face': 'face3d'
};

function RsRuntimePackagingHooks(app, configId, extraArgs, sharedState) {
  this._app = app;
  this._sharedState = sharedState;
  this._output = app.output;
  this._util = app.util;
  this._hooksTempPath = app.rootPath + Path.sep + 'hooksTemp';
  this._util.ShellJS.mkdir(this._hooksTempPath);

  this._moduleNamesFile = this._hooksTempPath + Path.sep + 'RS_MODULE_NAMES';
  this._postTaskLockFile = this._hooksTempPath + Path.sep + 'POST_TASK_LOCK';
}

RsRuntimePackagingHooks.prototype.prePackage = function(platform, callback) {
  this._app.output.info('Hooks: prePackage ' + MODULE_NAME + ' ' + platform);
  if (process.env.NO_RS_RUNTIME_HOOKS == 1 || process.env.NO_RS_RUNTIME_HOOKS == true) {
    this._app.output.warning(
        'Skip RealSense runtime packaging hooks, because NO_RS_RUNTIME_HOOKS was set.');
    callback(0);
    return;
  }
  fs.appendFileSync(this._moduleNamesFile, MODULE_NAME + ';');
  if (callback instanceof Function)
    callback(0);
};

RsRuntimePackagingHooks.prototype.postPackage = function(platform, callback) {
  this._app.output.info('Hooks: postPackage ' + MODULE_NAME + ' ' + platform);
  if (process.env.NO_RS_RUNTIME_HOOKS == 1 || process.env.NO_RS_RUNTIME_HOOKS == true) {
    this._app.output.warning(
        'Skip RealSense runtime packaging hooks, because NO_RS_RUNTIME_HOOKS was set.');
    callback(0);
    return;
  }
  // Get the lock to do post work.
  if (this._util.ShellJS.test('-f', this._postTaskLockFile)) {
    callback(0);
    return;
  }
  fs.closeSync(fs.openSync(this._postTaskLockFile, 'w'));

  // Get the generated msi file.
  var msiFile = this._app.generatedPackage;
  if (!this._util.ShellJS.test('-f', msiFile)) {
    this._output.error('Error: not msi found.');
    callback(1);
    return;
  }

  // Get the needed modules, registerred by prePackage phase.
  var modules = fs.readFileSync(this._moduleNamesFile, 'utf8');
  var length = modules.length;
  if (modules[length - 1] == ';') {
    modules = modules.substr(0, length - 1);
  }
  modules = modules.split(';');

  // Try to get the runtime installer.
  var runtimeFile = null;
  if (process.env.RS_RUNTIME_WEB_INSTALLER) {
    if (this._util.ShellJS.test('-f', process.env.RS_RUNTIME_WEB_INSTALLER)) {
      runtimeFile = process.env.RS_RUNTIME_WEB_INSTALLER;
    }
  }
  if (process.env.RS_RUNTIME_OFFLINE_INSTALLER) {
    // TODO(Donna):
    // Create right pre-bundle command line according to the modules
    // Pre-bundle the installer, so that we can just include the needed modules.
    // Bundle the customized runtime with Application MSI with correct
    // command line options.
  }
  // If no environment variables we can use to can runtime installer, we need to
  // downdown the web installer from website and then bundle it with App MSI.
  function bundleCbk(success) {
    if (callback instanceof Function) callback(success ? 0 : 1);
  }
  var tryTimes = 10;
  this.downloadFromUrl(RS_LICENSE_URL, '.', tryTimes, function(licenseFile, errorMsg) {
    if (!this._util.ShellJS.test('-f', licenseFile)) {
      this._output.warning('Failed to download license file, ' + errorMsg);
    }
    if (this._util.ShellJS.test('-f', runtimeFile)) {
      this.bundleThemAll(msiFile, runtimeFile, licenseFile, modules, bundleCbk);
      return;
    }
    this.downloadFromUrl(RS_RUNTIME_URL, '.', tryTimes, function(runtimeFile, errorMsg) {
      if (this._util.ShellJS.test('-f', runtimeFile)) {
        this.bundleThemAll(msiFile, runtimeFile, licenseFile, modules, bundleCbk);
      } else {
        this._output.error('Failed to download runtime installer, ' + errorMsg);
        callback(1);
      }
    }.bind(this));
  }.bind(this));
};

// Return name like:
// 'intel_rs_sdk_runtime_websetup_7.0.23.6161.exe'
function buildFileName(url) {
  return Path.basename(url);
  /*
     var name = 'intel_rs_sdk_runtime_';
     if (!offline)
     name = name + 'websetup_';
     return name + version + '.exe';
     */
}

function getWindowsVersion(appVersion) {
  // WiX wants 4 component version numbers, so append as many '.0' as needed.
  // Manifest versions are restricted to 4 parts max.
  if (!appVersion || appVersion.length < 1)
    return '0.0.0.0';
  var nComponents = appVersion.split('.').length;
  var versionPadding = new Array(4 - nComponents + 1).join('.0');
  return appVersion + versionPadding;
}

// To be used for cmd line arguments.
function InQuotes(arg) {
  return '\"' + arg + '\"';
}
RsRuntimePackagingHooks.prototype.runWix = function(basename, options, callback) {
  var candle = 'candle ' + options + ' ' + basename + '.wxs';
  this._output.info('Running "' + candle + '"');
  var child = child_process.exec(candle);

  child.stdout.on('data', function(data) {
    this.onData(data);
  }.bind(this));

  child.stderr.on('data', function(data) {
    this._output.warning(data);
  }.bind(this));

  child.on('exit', function(code, signal) {
    if (code) {
      this._output.error('Unhandled error ' + code);
      callback(false);
    } else {
      this.runWixLight(basename, options, callback);
    }
    return;
  }.bind(this));
};

RsRuntimePackagingHooks.prototype.runWixLight = function(basename, options, callback) {

  var light = 'light ' + options + ' ' + basename + '.wixobj';
  this._output.info('Running "' + light + '"');
  var child = child_process.exec(light);

  child.stdout.on('data', function(data) {
    this.onData(data);
  }.bind(this));

  child.stderr.on('data', function(data) {
    this._output.warning(data);
  }.bind(this));

  child.on('exit', function(code, signal) {
    if (code) {
      this._output.error('Unhandled error ' + code);
    }
    callback(code === 0);
    return;
  }.bind(this));
};

RsRuntimePackagingHooks.prototype.onData = function(data) {
};

RsRuntimePackagingHooks.prototype.selectIcon = function() {
  var output = this._output;
  var appPath = this._app.appPath;

  var icons = this._app.manifest.icons;
  var winIcon = null;
  if (icons && icons.length > 0) {
    for (var i = 0; i < icons.length; i++) {
      var icon = icons[i];
      var ext = Path.extname(icon.src).toLowerCase();
      if (ext === '.ico') {
        winIcon = icon.src;
        break;
      }
    }
  }

  if (winIcon) {
    winIcon = Path.join(appPath, winIcon);
  } else {
    output.warning('No icon in ".ico" format found in the manifest');
    output.warning('Using default crosswalk.ico');
    winIcon = Path.join(appPath, 'crosswalk.ico');
    this._util.ShellJS.cp(
        Path.join(__dirname, '..', '..', 'app-template', 'crosswalk.ico'), winIcon);
  }

  return winIcon;
};
// This callback of this function:
// function ([Boolean] success) {}
RsRuntimePackagingHooks.prototype.bundleThemAll =
    function(msiFile, runtimeFile, licenseFile, modules, callback) {
  this._output.info('Create a bundle with following files:');
  this._output.info('msiFile:' + msiFile);
  this._output.info('runtimeFile:' + runtimeFile);
  this._output.info('licenseFile:' + licenseFile);
  this._output.info('modules:' + modules);
  var root = this._util.XmlBuilder.create('Wix')
             .att('xmlns', 'http://schemas.microsoft.com/wix/2006/wi');
  var version = getWindowsVersion(this._app.manifest.appVersion);
  var bundle = root.ele('Bundle', {
    'Name': '!(bind.packageName.MainApp)',
    'Manufacturer': '!(bind.packageManufacturer.MainApp)',
    'Version': version,
    'IconSourceFile': this.selectIcon(),
    'UpgradeCode': this._util.NodeUuid.v1()
  });
  var bootStrapper = bundle.ele('BootstrapperApplicationRef', {
    'Id': 'WixStandardBootstrapperApplication.HyperlinkLicense'
  });
  var bal = bootStrapper.ele('bal:WixStandardBootstrapperApplication', {
    'xmlns:bal': 'http://schemas.microsoft.com/wix/BalExtension',
    'ShowVersion': 'yes',
    'LicenseUrl': ''
  });
  if (licenseFile && this._util.ShellJS.test('-f', licenseFile)) {
    bootStrapper.att('Id', 'WixStandardBootstrapperApplication.RtfLargeLicense');
    bal.att('LicenseFile', licenseFile);
  } else {
    this._output.warning('No license File for the bundle.');
    bootStrapper.att('Id', 'WixStandardBootstrapperApplication.HyperlinkLicense');
    bal.att('LicenseUrl', '');
  }
  var chain = bundle.ele('Chain');
  var rtCmdLine = getRuntimeCmdOptions(modules);
  this._output.info('RealSense runtime intall command:' + rtCmdLine);
  chain.ele('ExePackage', {
    'SourceFile': runtimeFile,
    'InstallCommand': rtCmdLine,
    'Vital': 'no'
  });
  chain.ele('RollbackBoundary');
  chain.ele('MsiPackage', {
    'Id': 'MainApp',
    'SourceFile': msiFile,
    'ForcePerMachine': 'yes',
    'Vital': 'yes'
  });
  var xml_str = root.end({ pretty: true });
  var basename = this._app.manifest.packageId + '_with_rssdk_runtime_' + version;
  fs.writeFileSync(basename + '.wxs', xml_str);
  var wixOptions = '-v -ext WixBalExtension';
  this.runWix(InQuotes(basename), wixOptions, function(success) {
    if (success) {
      //TODO(Donna): Should we exposePackagedFile like the original
      //             process of msi file?
      var bundleExe = Path.resolve(basename + '.exe');
      if (!this._util.ShellJS.test('-f', bundleExe)) {
        this._output.error('Bundle installer could not be found ' + bundleExe);
        success = false;
      } else {
        this._output.highlight('Installer including RealSense runtime: ' + bundleExe);
      }

      // Only delete on success, for debugging reasons.
      //Move the files to hooksTempDir in case the '-k' option was used.
      this._util.ShellJS.mv('-f', basename + '.wxs', this._hooksTempPath);
      this._util.ShellJS.mv('-f', basename + '.wixobj', this._hooksTempPath);
      this._util.ShellJS.mv('-f', basename + '.wixpdb', this._hooksTempPath);
    }
    if (callback instanceof Function)
      callback(success);
  }.bind(this));
};

function getRuntimeCmdOptions(modules) {
  var features = ' --passive --fnone=all --finstall=';
  modules.forEach(function(m, i) {
    if (FeatureNameMap.hasOwnProperty(m)) {
      features += FeatureNameMap[m];
      features += ',';
    }
  });
  features += 'core,vs_rt_2012';
  return features;
}


/**
 * Download file from a URL, checks for already existing file,
 * and returns it in case.
 * @param {String} url runtime URL string
 * @param {String} defaultPath Directory to download to if not already exists
 * @param {Number} tryTimes Max try times if download failed.
 * @param {downloadFinishedCb} callback callback function
 * @throws {FileCreationFailed} If download file could not be written.
 */
RsRuntimePackagingHooks.prototype.downloadFromUrl = function(url, defaultPath, tryTimes, callback) {
  // Namespaces

  var fileName = buildFileName(url);

  // Check for existing download in defaultPath, parent dir, and cache dir if set
  var handler = new this._util.DownloadHandler(defaultPath, fileName);
  var localDirs = [defaultPath, ''];
  if (process.env.RS_RUNTIME_CACHE_DIR)
    localDirs.push(process.env.RS_RUNTIME_CACHE_DIR);
  var localPath = handler.findLocally(localDirs);
  if (localPath) {
    this._output.info('Using cached', localPath);
    callback(localPath);
    return;
  }

  // Download
  var label = 'Downloading ' + url;
  var indicator = this._output.createFiniteProgress(label);

  var stream = handler.createStream();
  var downloader = new this._util.Downloader(url, stream);
  downloader.progress = function(progress) {
    indicator.update(progress);
  };
  downloader.get(function(errormsg) {
    indicator.done('');

    if (errormsg) {
      if (--tryTimes > 0) {
        this.downloadFromUrl(url, defaultPath, tryTimes, callback);
        return;
      }
      callback(null, errormsg);
    } else {
      var finishedPath = handler.finish(process.env.RS_RUNTIME_CACHE_DIR);
      callback(finishedPath);
    }
  }.bind(this));
};
module.exports = RsRuntimePackagingHooks;
