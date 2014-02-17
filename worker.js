var workerproxy = require('workerproxy');

var AssetsDB = require('./lib/assetsdb');

var db = new AssetsDB();

var fileReader = new FileReaderSync();

workerproxy({
  addFile: function (path, file, callback) {
    // TODO: Support webkitRelativePath property.
    db.addFile(path, file);
    callback(null);
  },

  addFileList: function (path, fileList, callback) {
    for (var i = 0; i < fileList.length; i++) {
      db.addFile(path, fileList.files[i]);
    }
    callback(null);
  },

  getBlobURL: function (path, callback) {
    callback(null, db.getBlobURL(path));
  },

  loadObjectResources: function (callback) {
    callback(null, db.loadResources('.object'));
  },

  loadTileResources: function (callback) {
    var resources = {
      materials: db.loadResources('.material'),
      matmods: db.loadResources('.matmod')
    };
    callback(null, resources);
  }
}, {catchErrors: true});
