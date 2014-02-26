module.exports = ResourceLoader;


function ResourceLoader(assetsManager, extension) {
  this.assets = assetsManager;
  this.extension = extension;

  this.index = null;

  this._loadingIndex = false;
}

ResourceLoader.prototype.get = function (id) {
  if (!this.index) return null;
  return this.index[id] || null;
};

ResourceLoader.prototype.loadIndex = function () {
  if (this._loadingIndex) return;
  this._loadingIndex = true;

  // TODO: Fat arrows.
  var self = this;
  this.assets.loadResources(this.extension, function (err, index) {
    self._loadingIndex = false;
    self.index = index;
  });
};
