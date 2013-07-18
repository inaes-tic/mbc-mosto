var melted_node = require('melted-node'),
    melted_xml  = require('node-mlt'),
    Status      = require('../../api/Status'),
    StatusClip  = require('../../api/StatusClip'),
    fs          = require('fs'),
    config      = require('mbc-common').config.Mosto.Melted,
    Q           = require('q'),
    utils       = require('../../utils'), 
    uuid        = require('node-uuid');

function melted(host, port) {
    var self = this;
    this.uuid = uuid.v4();
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Creating server instance [" + host + ":" + port + "]");
    this.mlt = new melted_node(host, port);
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Server instance created [" + this.mlt.host + ":" + this.mlt.port + "]");
}

melted.prototype.sendCommand = function(command) {
    var self = this;
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Sending command: " + command);
    return self.mlt.sendPromisedCommand(command, "200 OK");
};

melted.prototype.getServerPlaylist = function() {
    var self = this;
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Sending command: LIST U0");
    return self.mlt.sendPromisedCommand("list u0", "201 OK").then(function(response) {
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
                // remove sorrounding " from filename
                var file        = parse[1].replace(/^"|"$/g,'');
                var inFrame     = parse[2];
                var outFrame    = parse[3];
                var real_length = parse[4];
                var calc_length = parse[5];
                var fps         = parse[6];

                var aux         = file.split("/");
                var filename    = aux[aux.length - 1];
                var playlistId  = utils.getPlaylistIdFromXmlFileName(filename);
                var clipId      = utils.getClipIdFromXmlFileName(filename);

                var clip = new StatusClip(clipId, index, playlistId, fps, 0, real_length);

                clips.push(clip);
            }
        }
        return clips;
    }).fail(function(error) {
        var err = new Error("melted-node-driver (" + self.uuid + "): [ERROR] Error getting server playlist: " + error);
        console.error(err);
        throw err;
    });
};

melted.prototype.getServerStatus = function() {
    var self = this;
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Sending command: USTA U0");
    return self.mlt.sendPromisedCommand("usta u0", "202 OK").then(function(response) {
        // HACK: Converting the promise object to a string :)
        var data = "." + response;

        var split = data.split("\r\n");

        if (split.length>=2) {
            var parse = split[1].split(" ");
            if (parse.length>=17) {
                var status       = parse[1];
                // remove sorrounding " from filename
                var file         = parse[2].replace(/^"|"$/g,'');
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

                    var clip = new StatusClip(clipId, index, playlistId, fps, currentFrame, length);
                    var pos = utils.getCurrentPosFromClip(currentFrame, length);
                    st = new Status(status, clip, pos);
                } else {
                    st = new Status(status, undefined, 0);
                }
                return st;
            }
        }
        var err = new Error("melted-node-driver (" + self.uuid + "): [ERROR] Error getting server status in response object: " + response)
        throw (err);
    }).fail(function() {
        var err = new Error("melted-node-driver (" + self.uuid + "): [ERROR] Error getting server status: " + error);
        console.error(err);
        throw err;
    });
};

melted.prototype.isConnected = function() {
    var self = this;
    return self.mlt.connected;
};

melted.prototype.initServer = function() {
    var self = this;
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Connecting to server instance [" + self.mlt.host + ":" + self.mlt.port + "]");

    var deferred = Q.defer();

    var result = self.mlt.connect();

    result.then(function(response) {
        console.log("melted-node-driver (" + self.uuid + "): [INFO] Sending command: ULS");
        var aux = self.mlt.sendPromisedCommand("ULS", "201 OK");
        aux.then(function(response) {
            if (response.indexOf("U0") === -1) {
                deferred.reject(new Error("melted-node-driver (" + self.uuid + "): [ERROR] Unit 0 not found"));
            } else {
                deferred.resolve("OK");
            }
        }, function(error) {
            deferred.reject(new Error("melted-node-driver (" + self.uuid + "): [ERROR] Could not query Unit status: ") + error);
        });
    }, function(error) {
        deferred.reject(error);
    });

    return deferred.promise;
};

melted.prototype.stopServer = function() {
    var self = this;
    console.log("melted-node-driver (" + self.uuid + "): [INFO] Disconnecting from server instance [" + self.mlt.host + ":" + self.mlt.port + "]");

    return self.mlt.disconnect();
};

melted.prototype.sendClip = function(clip, command) {
    var self = this;
    var xml = new melted_xml();

    var type     = clip.type;
    var file     = clip.file;
    var filename = utils.getXmlFileNameFromClip(clip);

    //            var filters = self.config.types[type].filters;

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Generating file " + filename);

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Adding media [" + file + "] to file " + filename);
    var video = new melted_xml.Producer.Video({ source: file, startFrame: clip.in, length: clip.length });
    xml.push(video);

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Creating playlist xml object for file " + filename);
    var pl = new melted_xml.Playlist;
    pl.entry({producer: video});
    xml.push(pl);

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Creating track xml object for file " + filename);
    var track = new melted_xml.Multitrack.Track(pl);

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Creating multitrack xml object for file " + filename);
    var multitrack = new melted_xml.Multitrack;
    multitrack.addTrack(track);

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Creating tractor xml object for file " + filename);
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

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Pushing xml for file " + filename);
    xml.push(tractor);

    //        var fileName = file.substring(file.lastIndexOf("/") + 1);
    var xmlFile = config.playlists_xml_dir + "/" + filename;

    var deferred = Q.defer();

    console.log("melted-node-driver (" + self.uuid + "): [INFO] Writing file " + xmlFile);
    fs.writeFile(xmlFile, xml.toString({pretty:true}), function(err){
        if (err) {
            deferred.reject(err);
        } else {
            console.log("melted-node-driver (" + self.uuid + "): [INFO] File ready: " + xmlFile);
            deferred.resolve(self.sendCommand(command.replace("{xmlFile}", xmlFile)));
        }
    });
    return deferred.promise;
};

melted.prototype.loadClip = function(clip) {
    var self = this;
    //Load clip removing the whole playlist and starting playback
    return self.sendClip(clip, "LOAD U0 {xmlFile}");
};
melted.prototype.appendClip = function(clip) {
    var self = this;
    //Appends clip to the end of the playlist
    return self.sendClip(clip, "APND UO {xmlFile}");
};
melted.prototype.insertClip = function(clip, index) {
    var self = this;
    //Insert clip at specified index
    return self.sendClip(clip, "INSERT UO {xmlFile} " + index);
};
melted.prototype.removeClip = function(index) {
    var self = this;
    //Removes clip at specified index
    return self.sendCommand("REMOVE U0 " + index);
};
melted.prototype.cleanPlaylist = function() {
    var self = this;
    //Removes all clips but playing clip
    return self.sendCommand("CLEAN U0");
};
//    melted.prototype.wipePlaylist = function(successCallback, errorCallback) {
//        var self = this;
//        //Removes all clips before playing clip
//        self.sendCommand("WIPE U0", successCallback, errorCallback);
//    };
melted.prototype.clearPlaylist = function() {
    var self = this;
    //Removes all clips, including playing clip
    return self.sendCommand("CLEAR U0");
};
melted.prototype.moveClip = function(oldIndex, newIndex) {
    var self = this;
    //Moves the clip at oldIndex to newIndex (use it with getServerPlaylist)
    return self.sendCommand("MOVE U0 " + oldIndex + " " + newIndex);
};
melted.prototype.play = function() {
    var self = this;
    //Play
    return self.sendCommand("PLAY U0");
};
melted.prototype.stop = function() {
    var self = this;
    //Stop
    return self.sendCommand("STOP U0");
};
melted.prototype.pause = function() {
    var self = this;
    //Pause
    return self.sendCommand("PAUSE U0");
};
melted.prototype.goto = function(index, frame) {
    var self = this;
    //Starts playing clip at specified index and frame (use with getServerPlaylist and getServerStatus)
    return self.sendCommand("GOTO U0 " + frame + " " + index);
};
    
exports = module.exports = function(host, port) {
    var melted_node_driver = new melted(host, port);
    return melted_node_driver;
};

