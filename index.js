var merge = require('merge');
var workerproxy = require('workerproxy');

var region = require('./lib/region');

function AssetsManager(opt_options) {
  var options = {
    workerPath: __dirname + '/worker.js'
  };

  Object.seal(options);
  merge(options, opt_options);
  Object.freeze(options);

  this.options = options;

  var worker = new Worker(options.workerPath);
  this.api = workerproxy(worker);

  // Reroute some functions to the worker.
  this.addFile = this.api.addFile;
  this.getBlobURL = this.api.getBlobURL;
  this.getJSON = this.api.getJSON;
  this.loadObjectResources = this.api.loadObjectResources;
  this.loadTileResources = this.api.loadTileResources;
  this.openWorld = this.api.openWorld;
}

/**
 * Indexes a directory. All files in the directory will be reachable through
 * the assets database after this completes. All .pak/.modpak files will also
 * be loaded into the index.
 *
 * The virtual path argument is a prefix for the entries in the directory.
 */
AssetsManager.prototype.addDirectory = function (path, dirEntry, callback) {
  var self = this;

  var pending = 1;
  var decrementPending = function () {
    pending--;
    if (!pending) {
      callback(null);
    }
  };

  var reader = dirEntry.createReader();
  var next = function () {
    reader.readEntries(function (entries) {
      if (!entries.length) {
        process.nextTick(decrementPending);
        return;
      }

      entries.forEach(function (entry) {
        if (entry.name[0] == '.') return;

        var entryPath = path + '/' + entry.name;

        if (entry.isDirectory) {
          pending++;
          self.addDirectory(entryPath, entry, decrementPending);
        } else {
          pending++;
          entry.file(function (file) {
            self.addFile(entryPath, file, decrementPending);
          }, decrementPending);
        }
      });
      next();
    });
  };
  next();
};

AssetsManager.prototype.addRoot = function (dirEntry, callback) {
  this.addDirectory('', dirEntry, callback);
};

AssetsManager.prototype.getRegion = function (x, y, callback) {
  this.api.getRegion(x, y, function (err, regionData) {
    callback(null, new region.Region(regionData));
  });
};

exports.AssetsManager = AssetsManager;
