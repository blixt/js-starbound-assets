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

  getJSON: function (path, callback) {
    callback(null, db.getJSON(path));
  },

  loadResources: function (extension, callback) {
    callback(null, db.loadResources(extension));
  }
}, {catchErrors: true});
