var fs       = require('fs'),
    config   = require("./conf/json-driver"), 
    crypto   = require('crypto'), 
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media');

function json_driver() {
    var self = this;
    
    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;
    this.playlistsProvider      = undefined;
    
    console.log("mbc-mosto: [INFO] Creating json playlists driver");
    
    json_driver.prototype.start = function() {
        console.log("mbc-mosto: [INFO] Start watching playlists dir " + config.playlists.to_read) ;
        fs.watch(config.playlists.to_read, function(event, filename) {
            self.readPlaylists();
        });
        self.readPlaylists();
    };
    json_driver.prototype.registerNewPlaylistListener = function(newPlaylistCallback) {
        self.newPlaylistCallback = newPlaylistCallback;
    };
    json_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.updatePlaylistCallback = updatePlaylistCallback;
    };
    json_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.removePlaylistCallback = removePlaylistCallback;
    };
    json_driver.prototype.registerPlaylistsProvider = function(playlistsProvider) {
        self.playlistsProvider = playlistsProvider;
    };
    
    json_driver.prototype.readPlaylists =  function() {
        console.log("mbc-mosto: [INFO] Start reading playlists from " + config.playlists.to_read);
        var aux = fs.readdirSync(config.playlists.to_read);
        aux.forEach(function(element, index, array){
            //TODO: stop adding new elements!!! Instead, see what happened and act according to it
            self.createPlaylist(config.playlists.to_read, element, self.newPlaylistCallback);
        });
    };
    
    json_driver.prototype.createPlaylist = function(dir, name, callback) {
        console.log("mbc-mosto: [INFO] Reading playlist: " + name);
        var file = fs.readFileSync(dir + "/" + name);
        var aux = JSON.parse(file);
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
    
}

exports = module.exports = function() {
    var driver = new json_driver();
    return driver;
};
