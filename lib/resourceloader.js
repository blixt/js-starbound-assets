var convert = require("color-convert");
var EventEmitter = require('events');
var util = require('util');

module.exports = ResourceLoader;

// TODO: Implement custom class for objects as they are much more complex.
var IMAGE_FIELDS = {
  '.material': ['frames', 'platformImage', 'stairImage'],
  '.matmod': ['frames']
};

var IMAGE_FIELD_SUFFIX = '__image';

function ResourceLoader(assetsManager, extension) {
  EventEmitter.call(this);

  this.assets = assetsManager;
  this.extension = extension;

  this.index = null;
  this.images = null;

  this._loadingIndex = false;
  this._pending = [];
  this._emitting = false;
}
util.inherits(ResourceLoader, EventEmitter);

ResourceLoader.prototype.get = function (id) {
  if (!this.index) return null;
  return this.index[id] || null;
};

ResourceLoader.prototype.getImage = function (idOrResource, fieldName, opt_hueShift) {
  var resource = typeof idOrResource == 'string' ? this.get(idOrResource) : idOrResource;
  if (!resource) return null;

  fieldName += IMAGE_FIELD_SUFFIX;
  var image = resource[fieldName];
  if (!image) return null;
  if (!opt_hueShift) return image;

  fieldName += '__' + opt_hueShift;
  if (fieldName in resource) return resource[fieldName];

  var canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  var context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, image.width, image.height);

  var shift = opt_hueShift / 255 * 360, hsl, rgb;
  var imageData = context.getImageData(0, 0, image.width, image.height),
      data = imageData.data;
  for (var i = 0; i < data.length; i += 4) {
    hsl = convert.rgb2hsl(data[i], data[i + 1], data[i + 2]);
    hsl[0] = (hsl[0] + shift) % 360;
    rgb = convert.hsl2rgb(hsl);

    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
  }
  context.putImageData(imageData, 0, 0);

  image = new Image();
  image.src = canvas.toDataURL();
  resource[fieldName] = image;

  return image;
};

ResourceLoader.prototype.loadImages = function (ids) {
  var fields = IMAGE_FIELDS[this.extension];
  if (!fields) return;

  if (!this.index) {
    // Ensure that we're loading the index.
    this.loadIndex();

    // Queue the requested ids for later.
    Array.prototype.push.apply(this._pending, ids);

    return;
  }

  for (var i = 0; i < ids.length; i++) {
    var resource = this.index[ids[i]];
    if (!resource) {
      console.warn('Missing ' + this.extension.substr(1) + ' with id ' + ids[i]);
      continue;
    }

    for (var j = 0; j < fields.length; j++) {
      this._loadImage(resource, fields[j]);
    }
  }
};

ResourceLoader.prototype.loadIndex = function () {
  if (this._loadingIndex) return;
  this._loadingIndex = true;

  // TODO: Fat arrows.
  var self = this;
  this.assets.loadResources(this.extension, function (err, index) {
    self._loadingIndex = false;
    self.index = index;

    self.loadImages(self._pending);
    self._pending = [];
  });
};

ResourceLoader.prototype._loadImage = function (resource, field) {
  if (!(field in resource)) return;

  var imageField = field + IMAGE_FIELD_SUFFIX;

  // If the image is already loading, do nothing.
  if (imageField in resource) return;
  resource[imageField] = null;

  // Get an absolute path to the image.
  var path = resource[field];
  if (path[0] != '/') {
    var base = resource.__path__;
    path = base.substr(0, base.lastIndexOf('/') + 1) + path;
  }

  var self = this;
  this.assets.getBlobURL(path, function (err, url) {
    var image = new Image();
    image.src = url;
    image.onload = function () {
      resource[imageField] = image;
      if (!self._emitting) {
        self._emitting = true;
        process.nextTick(function () {
          self.emit('images');
          self._emitting = false;
        });
      }
    };
  });
};
