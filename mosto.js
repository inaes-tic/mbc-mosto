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
        //TODO: stop ordering and playing again all playlists!
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
           self.server.playPlaylist(element, function() {
                self.server.getServerPlaylist(function(data) {
                   console.log("Playlist loaded: ") ;
                   console.log(data);
                    self.server.getServerStatus(function(data) {
                       console.log("Currently playing: ") ;
                       console.log(data);
                    });
                });
           }); 
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
    this.driver     = new playlists_driver("json");
    
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