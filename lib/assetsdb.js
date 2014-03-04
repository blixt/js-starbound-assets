var Package = require('starbound-files').Package;

module.exports = AssetsDB;

// Used to prevent warnings in the browser.
var MIME_TYPES = {
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.wav': 'audio/x-wav'
};

// A list of file extensions that should have their own index as well.
var INDEXED_EXTENSIONS = {
  '.material': 'materialId',
  '.matmod': 'modId',
  '.object': 'objectName'
};

var fileReader = new FileReaderSync();

function getExtension(path) {
  var slashIndex = path.lastIndexOf('/'),
      dotIndex = path.lastIndexOf('.');
  if (dotIndex == -1 || slashIndex > dotIndex) return '';
  return path.substr(dotIndex).toLowerCase();
}

function AssetsDB() {
  this._index = Object.create(null);
  this._indexByExtension = Object.create(null);
}

AssetsDB.prototype.addFile = function (path, file) {
  // Merge the contents of package files into the index instead of treating
  // them as an individual asset.
  var extension = getExtension(file.name);
  if (extension == '.pak' || extension == '.modpak') {
    this.addPackage(Package.open(file));
  } else {
    this._indexAsset(path, file);
  }
};

/**
 * Adds a package to this assets database.
 */
AssetsDB.prototype.addPackage = function (pak) {
  var index = pak.getIndex();

  // Put all the package index entries into the asset database index.
  for (var path in index) {
    this._indexAsset(path, pak);
  }
};

/**
 * Gets a Blob object for the asset at the specified path.
 */
AssetsDB.prototype.getBlob = function (path) {
  // Get the object that contains the blob for the specified path.
  var object = this._index[path];

  if (!object) {
    throw new Error('Path is not in index');
  }

  // If it's not a package, it's already a blob.
  if (!(object instanceof Package)) {
    return object;
  }

  // It's a package.
  var buffer = object.get(path);

  // Get the mimetype for the extension so that the Blob can be provided
  // correctly.
  var meta = {}, extension = getExtension(path);
  if (extension in MIME_TYPES) {
    meta.type = MIME_TYPES[extension];
  }

  return new Blob([buffer], meta);
};

/**
 * Gets a URL for the asset at the specified path. This URL can be used to
 * load the asset into native DOM objects.
 */
AssetsDB.prototype.getBlobURL = function (path) {
  var blob = this.getBlob(path);
  return URL.createObjectURL(blob);
};

AssetsDB.prototype.getJSON = function (path) {
  var blob = this.getBlob(path);
  try {
    var json = fileReader.readAsText(blob);
    json = json.replace(/\/\/.*/g, '');

    var object = JSON.parse(json);
    // Sometimes necessary to calculate relative paths.
    object.__path__ = path;
    return object;
  } catch (e) {
    throw new Error('Could not parse ' + path + ' (' + e.message + ')');
  }
};

AssetsDB.prototype.loadResources = function (extension) {
  var list = this._indexByExtension[extension];
  if (!list) {
    return {};
  }

  var resources = {}, key = INDEXED_EXTENSIONS[extension];
  for (var i = 0; i < list.length; i++) {
    var resource = this.getJSON(list[i]);
    resources[resource[key]] = resource;
  }

  return resources;
};

AssetsDB.prototype._indexAsset = function (path, container) {
  if (path in this._index) {
    // XXX: Not sure how to handle this case so only warn for now.
    console.warn(path + ' already in index');
  }

  this._index[path] = container;

  // If this is an indexed extension, store it in another index as well.
  var extension = getExtension(path);
  if (INDEXED_EXTENSIONS[extension]) {
    if (this._indexByExtension[extension]) {
      this._indexByExtension[extension].push(path);
    } else {
      this._indexByExtension[extension] = [path];
    }
  }
};
