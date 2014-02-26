module.exports = ResourceLoader;


// TODO: Implement custom class for objects as they are much more complex.
var IMAGE_FIELDS = {
  '.material': ['frames', 'platformImage', 'stairImage'],
  '.matmod': ['frames']
};

var IMAGE_FIELD_SUFFIX = '__image';


function ResourceLoader(assetsManager, extension) {
  this.assets = assetsManager;
  this.extension = extension;

  this.index = null;

  this._loadingIndex = false;
  this._pending = [];
  this._emitting = false;
}

ResourceLoader.prototype.get = function (id) {
  if (!this.index) return null;
  return this.index[id] || null;
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
      var path = resource[fields[j]];
      if (!path) continue;

      // Make the path absolute.
      path = this.assets.getResourcePath(resource, resource[fields[j]]);
      this.assets.getImage(path);
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
