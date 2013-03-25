var json_driver = require("./json-driver");

function playlists_driver(type) {
    var self = this;
    
    this.driver = undefined;
    
    console.log("mbc-mosto: [INFO] Creating playlists driver for type [" + type + "]");
    
    if (type === 'json') {
        this.driver = new json_driver();
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
        self.driver.registerNewPlaylistListener(newPlaylistCallback);
    };
    playlists_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.driver.registerUpdatePlaylistListener(updatePlaylistCallback);
    };
    playlists_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.driver.registerRemovePlaylistListener(removePlaylistCallback);
    };
    playlists_driver.prototype.registerPlaylistsProvider = function(playlistsProvider) {
        self.driver.registerPlaylistsProvider(playlistsProvider);
    };
    
}

exports = module.exports = function(type) {
    var driver = new playlists_driver(type);
    return driver;
};
