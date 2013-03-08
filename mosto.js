var fs          = require('fs'),
    sys         = require('util'),
    exec        = require('child_process').exec,
    Q           = require('q'), 
    Playlist    = require('./api/Playlist'),
    Media       = require('./api/Media'), 
    mvcp_server = require('./drivers/mvcp/mvcp-driver'), 
    crypto      = require('crypto');
    
function mosto(configFile) {
    var self = this;
    
    mosto.prototype.startPlaylistsWatch = function() {
        console.log("mbc-mosto: [INFO] Start watching playlists dir " + self.config.playlists.to_read) ;
        fs.watch(self.config.playlists.to_read, function(event, filename) {
            self.readPlaylists();
        });
    };
    
    mosto.prototype.readPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start reading playlists from " + self.config.playlists.to_read);
        aux = fs.readdirSync(self.config.playlists.to_read);
        aux.forEach(function(element, index, array){
            console.log("mbc-mosto: [INFO] Reading playlist: " + element);
            var aux = require(self.config.playlists.to_read + "/" + element);
            console.log("mbc-mosto: [INFO] Parsing playlist:");
            console.log(aux);
            var medias = [];
            aux.medias.forEach(function(element, index, array) {
                var type;
                var file = element.file;
                if (element.type === undefined) {
                    //TODO: Where do we config the filters????
                    type = "default";
                } else {
                    type = element.type;
                }
                var media = new Media(type, file);
                medias.push(media);
            });
            
            var callback = undefined;
            if (index === (array.length - 1))
                callback = self.orderPlaylists;
            
            self.addPlaylist(element, aux.startDate, medias, callback);
        });
    };
    
    mosto.prototype.addPlaylist = function(name, startDate, medias, callback) {
        console.log("mbc-mosto: [INFO] Adding playlist " + name);
        var filename = self.config.playlists.to_read + "/" + name;
        var md5sum = crypto.createHash('md5');

        var s = fs.ReadStream(filename);
        s.on('data', function(d) {
            md5sum.update(d);
        });

        s.on('end', function() {
            var hash = md5sum.digest('hex');
            console.log("mbc-mosto: [INFO] Created hash [" + hash + "] for playlist " + name);
            var playlist = new Playlist(name, hash, startDate, medias);
            self.playlists.push(playlist);
            if (callback !== undefined)
                callback();
        });
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
        self.playlists.forEach(function(element, index, array){
           self.server.playPlaylist(element); 
        });
    };

    mosto.prototype.startWatching = function() {
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile);
        fs.watch(self.configFile, function(event, filename) {
            if (event === 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            this.config = require(this.configFile);
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
        this.configFile = './config.json';
    
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer();
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
var mosto_server = new mosto();