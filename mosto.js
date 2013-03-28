var fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 
    playlists_driver = require('./drivers/playlists/playlists-driver');
    
function mosto(configFile) {
    var self = this;
    
    mosto.prototype.addPlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Adding playlist " + playlist.name);
        self.playlists.push(playlist);
        console.log("mbc-mosto: [INFO] Added playlist:\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.updatePlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Updating playlist " + playlist.name);
        var i = -1;
        self.playlists.some(function(element, index, array) {
            if (element.name === playlist.name) {
                i = index;
                return true;
            }
        });
        playlist.loaded = self.playlists[i].loaded;
        self.playlists[i] = playlist;
        console.log("mbc-mosto: [INFO] Updated playlist:\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.removePlaylist = function(name) {
        console.log("mbc-mosto: [INFO] Removing playlist " + name);
        var i = -1;
        var playlist = undefined;
        self.playlists.some(function(element, index, array) {
            if (element.name === name) {
                i = index;
                playlist = element;
                return true;
            }
        });
        self.playlists.splice(i, 1);
        console.log("mbc-mosto: [INFO] Removed playlist:\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.orderPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start ordering playlists");
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Finish ordering playlists");
        self.playPlaylists();
    };
    
    mosto.prototype.playPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start playing playlists");
        self.playlists.forEach(function(element, index, array) {
            if (!element.loaded) {
                self.server.playPlaylist(element, function() {
                    self.server.getServerPlaylist(function(data) {
                        element.loaded = true;
                        console.log("Playlist loaded: ") ;
                        console.log(data);
                        self.server.getServerStatus(function(data) {
                            console.log("Currently playing: ") ;
                            console.log(data);
                        });
                    });
                }); 
            }
        });
    };

    mosto.prototype.startWatching = function() {
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile);
        fs.watch(self.configFile, function(event, filename) {
            if (event === 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            this.config = require(this.configFile);
        });
    };
    
    mosto.prototype.initDriver = function() {
        console.log("mbc-mosto: [INFO] Initializing playlists driver");
        self.driver.registerNewPlaylistListener(self.addPlaylist);
        self.driver.registerUpdatePlaylistListener(self.updatePlaylist);
        self.driver.registerRemovePlaylistListener(self.removePlaylist);
        self.driver.start();
    };
    
    mosto.prototype.startMvcpServer = function(callback) {
        var result = self.server.initServer();
        result.then(function() {
            callback();
        });
    };
    
    this.configFile = configFile;
    this.config     = false;
    this.playlists  = [];
    this.server     = new mvcp_server("melted");
    this.driver     = new playlists_driver("mongo");
    
    if (!this.configFile)
        this.configFile = './config.json';
    
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer(function() {
        self.startWatching();
        self.initDriver();
    });
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
var mosto_server = new mosto();