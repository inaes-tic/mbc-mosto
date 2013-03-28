var json_driver = require("./json-driver"),
    mongo_driver = require("./mongo-driver");

function playlists_driver(type) {
    var self = this;
    
    this.driver                = undefined;
    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;
    
    console.log("mbc-mosto: [INFO] Creating playlists driver for type [" + type + "]");
    
    if (type === 'json') {
        this.driver = new json_driver();
    } else if (type === 'mongo') {
        this.driver = new mongo_driver();
    } else {
        var err = new Error("mbc-mosto: [ERROR] Unknown type of driver [" + type + "]");
        console.error(err);
        throw err;
    }
    
    playlists_driver.prototype.start = function() {
        console.log("mbc-mosto: [INFO] Starting playlists driver");
        self.driver.start();
    };
    playlists_driver.prototype.registerNewPlaylistListener = function(newPlaylistCallback) {
        self.newPlaylistCallback = newPlaylistCallback;
        self.driver.registerNewPlaylistListener(self.addPlaylist);
    };
    playlists_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.updatePlaylistCallback = updatePlaylistCallback;
        self.driver.registerUpdatePlaylistListener(self.updatePlaylist);
    };
    playlists_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.removePlaylistCallback = removePlaylistCallback;
        self.driver.registerRemovePlaylistListener(self.removePlaylist);
    };
    
    playlists_driver.prototype.addPlaylist = function(playlist) {
        self.newPlaylistCallback(playlist);
    };
    playlists_driver.prototype.updatePlaylist = function(playlist) {
        self.updatePlaylistCallback(playlist);
    };
    playlists_driver.prototype.removePlaylist = function(playlist) {
        self.removePlaylistCallback(playlist);
    };
    
}

exports = module.exports = function(type) {
    var driver = new playlists_driver(type);
    return driver;
};
