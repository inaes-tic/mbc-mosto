var fs       = require('fs'),
    config   = require("mbc-common").config.Mosto.Json,
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    watchr   = require('watchr');

function json_driver() {
    var self = this;
    
    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;
    
    console.log("mbc-mosto: [INFO] Creating json playlists driver");
    
    json_driver.prototype.start = function() {
        console.log("mbc-mosto: [INFO] Start watching playlists dir " + config.to_read) ;
        watchr.watch({
            paths: [config.to_read],
            listeners: {
                error: function(err){
                    console.log("mbc-mosto: [ERROR] Error while watching playlists dir " + config.to_read, err);
                },
                watching: function(err, watcherInstance, isWatching){
                    if (err) {
                        console.log("mbc-mosto: [ERROR] Error while watching playlists dir " + config.to_read, err);
                    } else {
                        console.log("mbc-mosto: [INFO] Finish watching playlists dir " + config.to_read);
                    }
                },
                change: function(changeType, filePath, fileCurrentStat, filePreviousStat){
                    var name = self.getFileName(filePath);
                    
                    if (changeType === "create") {
                        console.log("mbc-mosto: [INFO] Playlist added: " + name);
                        self.createPlaylist(config.to_read, name, self.newPlaylistCallback); 
                    } else if (changeType === "update") {
                        console.log("mbc-mosto: [INFO] Playlist updated: " + name);
                        self.createPlaylist(config.to_read, name, self.updatePlaylistCallback);
                    } else if (changeType === "delete") {
                        console.log("mbc-mosto: [INFO] Playlist deleted: " + name);
                        self.removePlaylistCallback(name);
                    }
                }
            }
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
    
    json_driver.prototype.getFileName = function(path) {
        return path.substring(path.lastIndexOf("/") + 1);
    };
    
    json_driver.prototype.readPlaylists =  function() {
        console.log("mbc-mosto: [INFO] Start reading playlists from " + config.to_read);
        var aux = fs.readdirSync(config.to_read);
        aux.forEach(function(element, index, array){
            self.createPlaylist(config.to_read, element, self.newPlaylistCallback);
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
            var id           = self.getFileName(element.file);
            var orig_order   = index;
            var actual_order = undefined;
            var playlist_id  = name;
            var clip_name    = id;
            var type         = undefined;
            var file         = element.file;
            var length       = element.length;
            var fps          = element.fps;
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
                medias.push(new Media(id, orig_order, actual_order, playlist_id, clip_name, type, file, length, parseFloat(fps)));
                var clipLength = length.split(":");

                var clipHours   = clipLength[0];
                var clipMinutes = clipLength[1];
                var clipSeconds = clipLength[2];

                endDate.setSeconds(endDate.getSeconds() + parseInt(clipSeconds));
                endDate.setMinutes(endDate.getMinutes() + parseInt(clipMinutes));
                endDate.setHours(endDate.getHours() + parseInt(clipHours));
            }
            if (index === (array.length - 1)) {
                var playlist = new Playlist(name, name, startDate, medias, endDate);
                callback(playlist);
            }
        });
    };
    
}

exports = module.exports = function() {
    var driver = new json_driver();
    return driver;
};
