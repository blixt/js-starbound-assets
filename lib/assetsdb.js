var package = require('starbound-files').package;

// Used to prevent warnings in the browser.
var MIME_TYPES = {
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.wav': 'audio/x-wav'
};

// A list of file extensions that should have their own index as well.
var INDEXED_EXTENSIONS = [
  '.material',
  '.matmod',
  '.object'
];

var fileReader = new FileReaderSync();

var assetsDatabaseProto = {
  addFile: function (path, file) {
    // Merge the contents of package files into the index instead of treating
    // them as an individual asset.
    var extension = getExtension(file.name);
    if (extension == '.pak' || extension == '.modpak') {
      this.addPackage(package.open(file));
    } else {
      this._indexAsset(path, file);
    }
  },

  /**
   * Adds a package to this assets database.
   */
  addPackage: function (pak) {
    var index = pak.getIndex();

    // Register the package in the asset database.
    this._packages.push(pak);

    // Put all the package index entries into the asset database index.
    for (var i = 0; i < index.length; i++) {
      this._indexAsset(index[i], pak);
    }
  },

  /**
   * Gets a Blob object for the asset at the specified path.
   */
  getBlob: function (path) {
    if (!this._index[path]) {
      throw new Error('Path is not in index');
    }

    var object = this._index[path];

    // Handle individual files.
    if (object.name) {
      return object;
    }

    // Assume anything else is a package.
    var buffer = object.get(path);

    // Get the mimetype for the extension so that the Blob can be provided
    // correctly.
    var meta = {}, extension = getExtension(path);
    if (extension in MIME_TYPES) {
      meta.type = MIME_TYPES[extension];
    }

    return new Blob([buffer], meta);
  },

  /**
   * Gets a URL for the asset at the specified path. This URL can be used to
   * load the asset into native DOM objects.
   */
  getBlobURL: function (path) {
    if (path in this._cache) {
      var cacheObject = this._cache[path];
      cacheObject.lastAccess = Date.now();
      return cacheObject.url;
    }

    var blob = this.getBlob(path);
    var url = URL.createObjectURL(blob);

    var cacheObject = {
      lastAccess: Date.now(),
      url: url
    };
    this._cache[path] = cacheObject;

    return url;
  },

  getMaterials: function () {
    var list = this._indexByType['.material'];
    if (!list) {
      return {};
    }

    var materials = {};
    for (var i = 0; i < list.length; i++) {
      var blob = this.getBlob(list[i]);
      var data = JSON.parse(fileReader.readAsText(blob));
      materials[data.materialId] = data;
    }

    return materials;
  },

  _indexAsset: function (path, container) {
    if (path in this._index) {
      // XXX: Not sure how to handle this case so only warn for now.
      console.warn(path + ' already in index');
    }

    this._index[path] = container;

    // If this is an indexed extension, store it in another index as well.
    var extension = getExtension(path);
    if (INDEXED_EXTENSIONS.indexOf(extension) > -1) {
      if (this._indexByType[extension]) {
        this._indexByType[extension].push(path);
      } else {
        this._indexByType[extension] = [path];
      }
    }
  }
};

function getExtension(path) {
  var slashIndex = path.lastIndexOf('/'),
      dotIndex = path.lastIndexOf('.');
  if (dotIndex == -1 || slashIndex > dotIndex) return '';
  return path.substr(dotIndex).toLowerCase();
}

exports.create = function () {
  return Object.create(assetsDatabaseProto, {
    _cache: {value: {}},
    _index: {value: {}},
    _indexByType: {value: {}},
    _packages: {value: []}
  });
};
