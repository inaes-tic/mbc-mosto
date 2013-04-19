var melted_node = require('melted-node'),
    melted_xml  = require('node-mlt'),
    Status      = require('../../api/Status'),
    StatusClip  = require('../../api/StatusClip'),
    fs          = require('fs'),
    config      = require('./conf/melted-node-driver'),
    Q           = require('q'),
    utils       = require('../../utils');

function melted(host, port) {
    var self = this;
    console.log("mbc-mosto: [INFO] Creating server instance [" + host + ":" + port + "]");
    this.mlt = new melted_node(host, port);
    console.log("mbc-mosto: [INFO] Server instance created [" + this.mlt.host + ":" + this.mlt.port + "]");
    
    melted.prototype.sendCommand = function(command, successCallback, errorCallback) {
        console.log("mbc-mosto: [INFO] Sending command: " + command);
        self.mlt.sendCommand(command, "200 OK", successCallback, errorCallback);
    };
    
    melted.prototype.getServerPlaylist = function(successCallback, errorCallback) {
        self.mlt.sendCommand("list u0", "201 OK", function(response) {
            // HACK: Converting the promise object to a string :)
            var data = "." + response;

            var split = data.split("\r\n");
            var clips = [];
            for (var i = 0; i < split.length; i++) {
                var line = split[i];
                var parse = line.split(" ");

                if (parse.length >=7 ) {
                    console.log("getServerPlaylist:" + line );
                    var index       = parse[0];
                    var file        = parse[1];
                    var inFrame     = parse[2];
                    var outFrame    = parse[3];
                    var real_length = parse[4];
                    var calc_length = parse[5];
                    var fps         = parse[6];

                    var aux         = file.split("/");
                    var filename    = aux[aux.length - 1];
                    var playlistId  = utils.getPlaylistIdFromXmlFileName(filename);
                    var clipId      = utils.getClipIdFromXmlFileName(filename);

                    var clip = new StatusClip(clipId, index, playlistId);

                    clips.push(clip);
                }
            }
            successCallback(clips);
        }, function(error) {
            var err = new Error("mbc-mosto: [ERROR] Error getting server playlist: " + error);
            console.error(err);
            errorCallback(err);
        });
    };

    melted.prototype.getServerStatus = function(successCallback, errorCallback) {
        self.mlt.sendCommand("usta u0", "202 OK", function(response) {
            // HACK: Converting the promise object to a string :)
            var data = "." + response;

            var split = data.split("\r\n");

            if (split.length>=2) {
                var parse = split[1].split(" ");
                if (parse.length>=17) {
                    var status       = parse[1];
                    var file         = parse[2];
                    var currentFrame = parse[3];
                    var fps          = parse[5];
                    var inPoint      = parse[6];
                    var outPoint     = parse[7];
                    var length       = parse[8];
                    var index        = parse[16];

                    var st = undefined;

                    if (file.split(".").length > 1) {
                        var aux         = file.split("/");
                        var filename    = aux[aux.length - 1];
                        var playlistId  = utils.getPlaylistIdFromXmlFileName(filename);
                        var clipId      = utils.getClipIdFromXmlFileName(filename);

                        var clip = new StatusClip(clipId, index, playlistId);
                        var pos = utils.getCurrentPosFromClip(currentFrame, length);
                        st = new Status(status, clip, pos);
                    } else {
                        st = new Status(status, undefined, 0);
                    }
                    return successCallback(st);
                }
            }
            var err = new Error("mbc-mosto: [ERROR] Error getting server status in response object: " + response)
            errorCallback(err);
        }, function(error) {
            var err = new Error("mbc-mosto: [ERROR] Error getting server status: " + error);
            console.error(err);
            errorCallback(err);
        });
    };

    melted.prototype.isConnected = function() {
        return self.mlt.connected;
    };
    
    melted.prototype.initServer = function() {
        console.log("mbc-mosto: [INFO] Connecting to server instance [" + self.mlt.host + ":" + self.mlt.port + "]");

        var deferred = Q.defer();
        
        var result = self.mlt.connect();
        
        result.then(function(response) {
            var aux = self.mlt.sendPromisedCommand("ULS", "201 OK");
            aux.then(function(response) {
                if (response.indexOf("U0") === -1) {
                    deferred.reject(new Error("mbc-mosto: [ERROR] Unit 0 not found"));
                } else {
                    deferred.resolve("OK");
                }
            }, function(error) {
                deferred.reject(new Error("mbc-mosto: [ERROR] Could not query Unit status: ") + error);
            });
        }, function(error) {
            deferred.reject(error);
        });
        
        return deferred.promise;
    };
    
    melted.prototype.sendClip = function(clip, command, successCallback, errorCallback) {
        var xml = new melted_xml();

        var type     = clip.type;
        var file     = clip.file;
        var filename = utils.getXmlFileNameFromClip(clip);

        //            var filters = self.config.types[type].filters;

        console.log("mbc-mosto: [INFO] Generating file " + filename);

        console.log("mbc-mosto: [INFO] Adding media [" + file + "] to file " + filename);
        var video = new melted_xml.Producer.Video({source: file});
        xml.push(video);

        console.log("mbc-mosto: [INFO] Creating playlist xml object for file " + filename);
        var pl = new melted_xml.Playlist;
        pl.entry({producer: video});
        xml.push(pl);

        console.log("mbc-mosto: [INFO] Creating track xml object for file " + filename);
        var track = new melted_xml.Multitrack.Track(pl);

        console.log("mbc-mosto: [INFO] Creating multitrack xml object for file " + filename);
        var multitrack = new melted_xml.Multitrack;
        multitrack.addTrack(track);

        console.log("mbc-mosto: [INFO] Creating tractor xml object for file " + filename);
        var tractor = new melted_xml.Tractor;
        tractor.push(multitrack);

        //            console.log("mbc-mosto: [INFO] Creating filter xml objects for file " + filename);
        //            console.log("mbc-mosto: [INFO] Filters: " + filters);
        //            filters.forEach(function(element, index, array){
        //                var filter = self.config.filters[element];
        //                var filterObj = new melted_xml.Filter[filter.filter.charAt(0).toUpperCase() + filter.filter.slice(1)](filter.properties);
        //                console.log("mbc-mosto: [INFO] Adding filter " + filter.filter);
        //                console.log(filter.properties);
        //                tractor.push(filterObj);
        //            });

        console.log("mbc-mosto: [INFO] Pushing xml for file " + filename);
        xml.push(tractor);

        //        var fileName = file.substring(file.lastIndexOf("/") + 1);
        var xmlFile = config.playlists_xml_dir + "/" + filename;

        console.log("mbc-mosto: [INFO] Writing file " + xmlFile);
        fs.writeFile(xmlFile, xml.toString({pretty:true}), function(err){
            if (err) {
                errorCallback(err);
            } else {
                console.log("mbc-mosto: [INFO] File ready: " + xmlFile);
                self.sendCommand(command.replace("{xmlFile}", xmlFile), successCallback, errorCallback);
            }
        });
    };
    
    melted.prototype.loadClip = function(clip, successCallback, errorCallback) {
        //Load clip removing the whole playlist and starting playback
        self.sendClip(clip, "LOAD U0 {xmlFile}", successCallback, errorCallback);
    };
    melted.prototype.appendClip = function(clip, successCallback, errorCallback) {
        //Appends clip to the end of the playlist
        self.sendClip(clip, "APND UO {xmlFile}", successCallback, errorCallback);
    };
    melted.prototype.insertClip = function(clip, index, successCallback, errorCallback) {
        //Insert clip at specified index
        self.sendClip(clip, "INSERT UO {xmlFile} " + index, successCallback, errorCallback);
    };
    melted.prototype.removeClip = function(index, successCallback, errorCallback) {
        //Removes clip at specified index
        self.sendCommand("REMOVE U0 " + index, successCallback, errorCallback);
    };
    melted.prototype.cleanPlaylist = function(successCallback, errorCallback) {
        //Removes all clips but playing clip
        self.sendCommand("CLEAN U0", successCallback, errorCallback);
    };
    //    melted.prototype.wipePlaylist = function(successCallback, errorCallback) {
    //        //Removes all clips before playing clip
    //        self.sendCommand("WIPE U0", successCallback, errorCallback);
    //    };
    melted.prototype.clearPlaylist = function(successCallback, errorCallback) {
        //Removes all clips, including playing clip
        self.sendCommand("CLEAR U0", successCallback, errorCallback);
    };
    melted.prototype.moveClip = function(oldIndex, newIndex, successCallback, errorCallback) {
        //Moves the clip at oldIndex to newIndex (use it with getServerPlaylist)
        self.sendCommand("MOVE U0 " + oldIndex + " " + newIndex, successCallback, errorCallback);
    };
    melted.prototype.play = function(successCallback, errorCallback) {
        //Play
        self.sendCommand("PLAY U0", successCallback, errorCallback);
    };
    melted.prototype.stop = function(successCallback, errorCallback) {
        //Stop
        self.sendCommand("STOP U0", successCallback, errorCallback);
    };
    melted.prototype.pause = function(successCallback, errorCallback) {
        //Pause
        self.sendCommand("PAUSE U0", successCallback, errorCallback);
    };
    melted.prototype.goto = function(index, frame, successCallback, errorCallback) {
        //Starts playing clip at specified index and frame (use with getServerPlaylist and getServerStatus)
        self.sendCommand("GOTO U0 " + frame + " " + index, successCallback, errorCallback);
    };
}

exports = module.exports = function(host, port) {
    var melted_node_driver = new melted(host, port);
    return melted_node_driver;
};

