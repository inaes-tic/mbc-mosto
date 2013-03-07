var fs          = require('fs'),
    yaml        = require('yaml'),
    sys         = require('util'),
    exec        = require('child_process').exec,
    Q           = require('q'), 
    Playlist    = require('./api/Playlist.js'),
    Media       = require('./api/Media.js'), 
    mvcp_server = require('./drivers/mvcp/mvcp-driver');
    
function mosto(configFile) {
    var self = this;
    
    mosto.prototype.startPlaylistsWatch = function() {
        console.log("mbc-mosto: [INFO] Start watching playlists dir " + self.config.playlists.base) ;
        fs.watch(self.config.playlists.base, function(event, filename) {
            self.readPlaylists();
        });
    };
    
    mosto.prototype.readConfig = function(callback) {
        console.log("mbc-mosto: [INFO] Reading configuration from " + self.configFile);
        var fileContents = fs.readFileSync(self.configFile);
        if (!fileContents) 
            throw new Error("mbc-mosto: [ERROR] Couldnt read config file " + self.configFile);
        self.config = yaml.eval(fileContents.toString());
        callback();
    };

    mosto.prototype.readPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start reading playlists from " + self.config.playlists.base);
        aux = fs.readdirSync(self.config.playlists.base);
        aux.forEach(function(element, index, array){
            var fileContents = fs.readFileSync(self.config.playlists.base + "/" + element);
            if (!fileContents) {
                //TODO: do it better
                console.error("mbc-mosto: [ERROR] Couldnt read playlist file " + element);
            } else {
                console.log("mbc-mosto: [INFO] Reading playlist: " + element);
                var aux = yaml.eval(fileContents.toString());
                console.log("mbc-mosto: [INFO] Adding playlist:");
                console.log(aux);
                var medias = [];
                aux.files.forEach(function(element, index, array) {
                    var type;
                    var file;
                    if (typeof element === 'string') {
                        type = self.config.types.defecto;
                        file = element;
                    } else {
                        type = element.type;
                        file = element.file;
                    }
                    var media = new Media(type, file);
                    medias.push(media);
                });
                var playlist = new Playlist(element, aux.startDate, medias);
                self.playlists.push(playlist);
            }
            self.orderPlaylists();
        });
    };
    
    mosto.prototype.orderPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start ordering playlists:");
        console.log(self.playlists);
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Ordered playlists:");
        console.log(self.playlists);
        self.playlists.forEach(function(element, index, array){
           self.server.playPlaylist(element); 
        });
    };

    mosto.prototype.startWatching = function() {
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile);
        fs.watch(self.configFile, function(event, filename) {
            if (event === 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            self.readConfig();
        });

        self.startPlaylistsWatch();
        self.readPlaylists();
    };
    
    mosto.prototype.startMvcpServer = function() {
        var result = self.server.initServer();
        result.then(function() {
            self.startWatching();
        });
    };
    
    this.configFile = configFile;
    this.config     = false;
    this.playlists  = [];
    this.server     = new mvcp_server("melted");
    
    if (!this.configFile)
        this.configFile = "mosto-config.yml";
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... " + self.configFile) ;
    
    self.readConfig(self.startMvcpServer);
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
var mosto_server = new mosto();