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
        var aux = fs.readdirSync(self.config.playlists.to_read);
        aux.forEach(function(element, index, array){
            var callback = undefined;

            if (index === (array.length - 1)) {
                callback = function(playlist) {
                    self.addPlaylist(playlist, self.orderPlaylists);
                };
            } else {
                callback = function(playlist) {
                    self.addPlaylist(playlist);
                };
            }
            
            self.createPlaylist(self.config.playlists.to_read, element, callback);
        });
    };
    
    mosto.prototype.addPlaylist = function(playlist, callback) {
        console.log("mbc-mosto: [INFO] Adding playlist " + playlist.name);
        self.playlists.push(playlist);
        console.log("mbc-mosto: [INFO] Added playlist:\nname: " + playlist.name 
                + "\nhash: " + playlist.hash 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        if (callback !== undefined)
            callback();
    };
    
    mosto.prototype.createPlaylist = function(dir, name, callback) {
        console.log("mbc-mosto: [INFO] Reading playlist: " + name);
        var aux = require(dir + "/" + name);
        console.log("mbc-mosto: [INFO] Parsing playlist:");
        console.log(aux);

        var split = aux.startDate.split(" ");

        var date = split[0];
        var time = split[1];

        var dateSplit = date.split("/");
        var timeSplit = time.split(":");

        var day    = dateSplit[0];
        var month  = dateSplit[1];
        var year   = dateSplit[2];
        var hour   = timeSplit[0];
        var minute = timeSplit[1];
        var second = timeSplit[2];

        var startDate = new Date(year, month - 1, day, hour, minute, second);
        var endDate   = new Date(year, month - 1, day, hour, minute, second);

        var medias = [];
        aux.medias.forEach(function(element, index, array) {
            var type   = undefined;
            var file   = element.file;
            var length = element.length;
            var fps    = element.fps;
            if (element.type === undefined) {
                //TODO: Where do we config the filters????
                type = "default";
            } else {
                type = element.type;
            }
            if (file === undefined) {
                console.warn("mbc-mosto: [WARNING] Cant add a media without the [file] attribute, skipping...");
            } else if (length === undefined) {
                console.warn("mbc-mosto: [WARNING] Cant add media [" + file + "] without the [length] attribute, skipping...");
            } else if (length === undefined) {
                console.warn("mbc-mosto: [WARNING] Cant add media [" + file + "] without the [fps] attribute, skipping...");
            } else {
                medias.push(new Media(type, file, length, parseFloat(fps)));
                var clipLength = length.split(":");

                var clipHours   = clipLength[0];
                var clipMinutes = clipLength[1];
                var clipSeconds = clipLength[2];

                endDate.setSeconds(endDate.getSeconds() + parseInt(clipSeconds));
                endDate.setMinutes(endDate.getMinutes() + parseInt(clipMinutes));
                endDate.setHours(endDate.getHours() + parseInt(clipHours));
            }
        });
            

        var filename = dir + "/" + name;
        var md5sum = crypto.createHash('md5');

        var s = fs.ReadStream(filename);
        s.on('data', function(d) {
            md5sum.update(d);
        });

        s.on('end', function() {
            var hash = md5sum.digest('hex');
            var playlist = new Playlist(name, hash, startDate, medias, endDate);
            callback(playlist);
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
        self.playPlaylists();
    };
    
    mosto.prototype.playPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start playing playlists");
        self.playlists.forEach(function(element, index, array){
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