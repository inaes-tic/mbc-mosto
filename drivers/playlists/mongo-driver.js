var config   = require("./conf/mongo-driver"),
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment");

var db = require('./db').db();
function mongo_driver() {
    var self = this;

    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;

    console.log("mbc-mosto: [INFO] Creating mongodb playlists driver");

    mongo_driver.prototype.start = function() {
        self.scheds = db.collection('scheds');
        self.lists = db.collection('lists');
    };
    mongo_driver.prototype.registerNewPlaylistListener = function(newPlaylistCallback) {
        self.newPlaylistCallback = newPlaylistCallback;
    };
    mongo_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.updatePlaylistCallback = updatePlaylistCallback;
    };
    mongo_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.removePlaylistCallback = removePlaylistCallback;
    };
    
    mongo_driver.prototype.getFileName = function(path) {
        return path.substring(path.lastIndexOf("/"));
    };
    
}

exports = module.exports = function() {
    var driver = new mongo_driver();
    return driver;
};
