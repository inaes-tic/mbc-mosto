var json_driver = require("./json-driver"),
    mongo_driver = require("./mongo-driver");

function playlists_driver(type, config) {
    var self = this;
    
    this.driver                = undefined;
    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;
    
    console.log("mbc-mosto: [INFO] Creating playlists driver for type [" + type + "]");
    
    if (type === 'json') {
        this.driver = new json_driver(config);
    } else if (type === 'mongo') {
        this.driver = new mongo_driver(config);
    } else {
        var err = new Error("mbc-mosto: [ERROR] Unknown type of driver [" + type + "]");
        console.error(err);
        throw err;
    }
    
    playlists_driver.prototype.start = function(ops) {
        console.log("mbc-mosto: [INFO] Starting playlists driver");
        self.driver.start(ops);
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
    playlist_driver.prototype.setWindow = function(from, to) {
        /******************************************************************
         * this receives either a from=date, to=date or an object that is
         * interpreted as follows:
         * {
         *   from: date,
         *   to: date,
         *   span: int,
         * }
         * span should be in milliseconds
         * if from is absent, it is assumed to be `now`.
         * if either one of `to` or `span` is be present, the missing one is calculated
         * using `from` and the other one thus:
         * span = (to - from) // this is in miliseconds
         * to = from + span
         * if both are absent, the config file is used to get the span value
         * it returns the window object with the structure above (always complete)
         *******************************************************************/
        return self.driver.setWindow(from, to);
    };
    playlist_driver.prototype.getPlaylists = function(ops, callback) {
        /******************************************************************
         * ops is 
         * {
         *    from: date
         *    to: date
         *    setWindow: boolean
         * }
         * with the same description as in setWindow
         ******************************************************************/
        return self.driver.getPlaylists(ops, callback);
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

exports = module.exports = function(type, config) {
    var driver = new playlists_driver(type, config);
    return driver;
};
