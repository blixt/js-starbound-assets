var workerproxy = require('workerproxy');

var assetsdb = require('./lib/assetsdb');
var worldmanager = require('./lib/worldmanager');

var db = assetsdb.create();
var worldManager = worldmanager.create();

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

  getRegion: function (x, y, callback) {
    var region = worldManager.getRegion(x, y);
    callback.transfer([region.buffer], null, region);
  },

  loadResources: function (extension, callback) {
    var resources = db.loadResources(extension);
    callback(null, resources);
  },

  openWorld: function (file, callback) {
    worldManager.open(file);
    callback(null, worldManager.metadata);
  }
}, {catchErrors: true});
