var world = require('starbound-files').world;

function WorldManager() {
  this.metadata = null;
  this.world = null;
}

WorldManager.prototype.open = function (file) {
  if (this.world) {
    throw new Error('A world has already been opened.');
  }

  this.world = world.open(file);
  this.metadata = this.world.getMetadata();
};

WorldManager.prototype.getRegion = function (x, y) {
  if (!this.world) {
    throw new Error('A world has to be opened before getting regions.');
  }

  // TODO: Cache regions.
  var buffer = this.world.getRegionData(1, x, y),
      entities = this.world.getEntities(x, y);
  return {buffer: buffer, entities: entities};
};

exports.WorldManager = WorldManager;
exports.create = function () {
  return new WorldManager();
};
