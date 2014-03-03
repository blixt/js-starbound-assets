var convert = require('color-convert');
var EventEmitter = require('events');
var merge = require('merge');
var util = require('util');
var workerproxy = require('workerproxy');

var ResourceLoader = require('./resourceloader');


module.exports = AssetsManager;


function AssetsManager(opt_options) {
  EventEmitter.call(this);

  var options = {
    workerPath: __dirname + '/../worker.js'
  };

  Object.seal(options);
  merge(options, opt_options);
  Object.freeze(options);

  this.options = options;

  var worker = new Worker(options.workerPath);
  this.api = workerproxy(worker, {timeCalls: true});

  this._emitting = {};
  // TODO: Make a more generic cache?
  this._framesCache = Object.create(null);
  this._imageCache = Object.create(null);
}
util.inherits(AssetsManager, EventEmitter);

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

AssetsManager.prototype.addFile = function (path, file, callback) {
  this.api.addFile(path, file, callback);
};

AssetsManager.prototype.addRoot = function (dirEntry, callback) {
  this.addDirectory('', dirEntry, callback);
};

AssetsManager.prototype.emitOncePerTick = function (event) {
  if (this._emitting[event]) return;
  this._emitting[event] = true;

  var self = this, args = Array.prototype.slice.call(arguments);
  process.nextTick(function () {
    self.emit.apply(self, args);
    delete self._emitting[event];
  });
};

AssetsManager.prototype.getBlobURL = function (path, callback) {
  this.api.getBlobURL(path, callback);
};

AssetsManager.prototype.getFrames = function (imagePath) {
  var dotOffset = imagePath.lastIndexOf('.');
  var path = imagePath.substr(0, dotOffset) + '.frames';

  if (path in this._framesCache) return this._framesCache[path];
  this._framesCache[path] = null;

  var self = this;
  this.api.getJSON(path, function (err, frames) {
    if (err) {
      console.error(err.stack);
      return;
    }

    self._framesCache[path] = frames;
  });

  return null;
};

/**
 * Gets the image for the specified path. This function is synchronous, but may
 * depend on asynchronous operations. If the image is not immediately available
 * this function will return null. Once more images are available, an "images"
 * event will be emitted.
 */
AssetsManager.prototype.getImage = function (path) {
  // Example path: "/directory/image.png?hueshift=60?fade=ffffff=0.1"
  if (path in this._imageCache) return this._imageCache[path];

  var self = this;

  // Extract image operations.
  var ops = path.split('?');
  // Get the plain path to the image file.
  var filePath = ops.shift();

  // If the image is not in the cache, load it and trigger an "images" event
  // when it's done.
  if (!(filePath in this._imageCache)) {
    this._imageCache[filePath] = null;

    this.getBlobURL(filePath, function (err, url) {
      if (err) {
        console.warn('Failed to load %s (%s)', filePath, err.message);
        return;
      }

      var image = new Image();
      image.src = url;
      image.onload = function () {
        self._imageCache[filePath] = image;
        self.emitOncePerTick('images');
      };
    });
  }

  var image = this._imageCache[filePath];
  if (!image) return null;

  // Apply operations (such as hue shift) on the image.
  var canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  // Parse all the operations to be applied to the image.
  // TODO: addmask, brightness, fade, replace, saturation
  var hue = 0, flipEveryX = 0;
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i].split(/[=;]/);
    switch (op[0]) {
      // This operation doesn't exist in Starbound, but is helpful for us.
      case 'flipgridx':
        flipEveryX = parseInt(op[1]);
        if (image.width % flipEveryX) {
          throw new Error(image.width + ' not divisible by ' + flipEveryX + ' (' + path + ')');
        }
        break;
      case 'hueshift':
        hue = parseFloat(op[1]);
        break;
      default:
        console.warn('Unsupported image operation:', op);
    }
  }

  var context = canvas.getContext('2d');

  if (flipEveryX) {
    context.save();
    context.scale(-1, 1);
    for (var x = 0; x < image.width; x += flipEveryX) {
      var flippedX = -(x + flipEveryX), dw = flipEveryX, dh = image.height;
      context.drawImage(image, x, 0, dw, dh, flippedX, 0, dw, dh);
    }
    context.restore();
  } else {
    context.drawImage(image, 0, 0);
  }

  if (hue) {
    var imageData = context.getImageData(0, 0, image.width, image.height),
        data = imageData.data;
    for (var i = 0; i < data.length; i += 4) {
      hsv = convert.rgb2hsv(data[i], data[i + 1], data[i + 2]);

      hsv[0] += hue;
      if (hsv[0] < 0) hsv[0] += 360
      else if (hsv[0] >= 360) hsv[0] -= 360;

      rgb = convert.hsv2rgb(hsv);

      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
    context.putImageData(imageData, 0, 0);
  }

  self._imageCache[path] = null;

  // Create a new object for the modified image and cache it.
  image = new Image();
  image.onload = function () {
    self._imageCache[path] = image;
    self.emitOncePerTick('images');
  };
  image.src = canvas.toDataURL();

  return null;
};

AssetsManager.prototype.getResourceLoader = function (extension) {
  return new ResourceLoader(this, extension);
};

AssetsManager.prototype.getResourcePath = function (resource, path) {
  if (path[0] == '/') return path;
  var base = resource.__path__;
  return base.substr(0, base.lastIndexOf('/') + 1) + path;
};

AssetsManager.prototype.getTileImage = function (resource, field, opt_hueShift) {
  path = this.getResourcePath(resource, resource[field]);

  // Add hueshift image operation if needed.
  if (opt_hueShift) {
    path += '?hueshift=' + (opt_hueShift / 255 * 360);
  }

  return this.getImage(path);
};

AssetsManager.prototype.loadResources = function (extension, callback) {
  var self = this;
  this.api.loadResources(extension, function (err, resources) {
    callback(err, resources);
    if (!err) {
      self.emitOncePerTick('resources');
    }
  });
};
