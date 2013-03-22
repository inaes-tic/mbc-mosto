function playlists_driver(type) {
    var self = this;
    
    this.driver                 = undefined;
    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;
    this.playlistsProvider      = undefined;
    
    console.log("mbc-mosto: [INFO] Creating playlists driver for type [" + type + "]");
    
    if (type === 'json') {
        this.driver = new json_driver();
    } else {
        var err = new Error("mbc-mosto: [ERROR] Unknown type of driver [" + type + "]");
        console.error(err);
        throw err;
    }
    
    playlists_driver.prototype.startWatching = function() {
        self.driver.startWatching(syncPlaylists);
    };
    playlists_driver.prototype.registerNewPlaylistListener = function(newPlaylistCallback) {
        self.newPlaylistCallback = newPlaylistCallback;
    };
    playlists_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.updatePlaylistCallback = updatePlaylistCallback;
    };
    playlists_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.removePlaylistCallback = removePlaylistCallback;
    };
    playlists_driver.prototype.registerPlaylistsProvider = function(playlistsProvider) {
        self.playlistsProvider = playlistsProvider;
    };
    
    function syncPlaylists(playlists) {
        // get actual playlists loaded from mosto
        var oldPlaylists = playlistsProvider.getPlaylists();
        // compare them with the playlists received
        // be aware of discard old (ended) playlists
        // check for new, removed or changed playlists (use hash for this in json)
        // call appropiate callbacks
    };
}