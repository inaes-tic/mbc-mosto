var melted_node = require('melted-node'),
    melted_xml  = require('node-mlt'),
    Status      = require('../../api/Status'),
    StatusClip  = require('../../api/StatusClip'),
    fs          = require('fs'),
    config      = require('mbc-common').config.Mosto.Melted,
    Q           = require('q'),
    utils       = require('../../utils'), 
    logger      = require('../../logger').addLogger('MELTED-NODE-DRIVER'),
    melted_log  = require('../../logger').addLogger('MELTED-NODE'),
    path        = require('path'),
    uuid        = require('node-uuid');

function melted(host, port, timeout) {
    var self = this;
    this.uuid = uuid.v4();
    logger.debug(self.uuid + " - Creating server instance [" + host + ":" + port + "]");
    this.mlt = new melted_node(host, port, melted_log, timeout);
    logger.debug(self.uuid + " - Server instance created [" + this.mlt.host + ":" + this.mlt.port + "]");
}

melted.prototype.sendCommand = function(command) {
    var self = this;
    logger.debug(self.uuid + " - Sending command: " + command);
    return self.mlt.sendPromisedCommand(command, "200 OK");
};

melted.prototype.getServerPlaylist = function() {
    var self = this;
    logger.debug(self.uuid + " - Sending command: LIST U0");
    return self.mlt.sendPromisedCommand("list u0", "201 OK").then(function(response) {
        // HACK: Converting the promise object to a string :)
        var data = "." + response;

        var split = data.split("\r\n");
        var clips = [];
        for (var i = 0; i < split.length; i++) {
            var line = split[i];
            var parse = line.split(" ");

            if (parse.length >=7 ) {
                logger.debug(self.uuid + " - getServerPlaylist:" + line );
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
        var err = new Error(self.uuid + " - Error getting server playlist: " + error);
        logger.error(err.message);
        throw err;
    });
};

melted.prototype.getServerStatus = function() {
    var self = this;
    logger.debug(self.uuid + " - Sending command: USTA U0");
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
        var err = new Error(self.uuid + " - Error getting server status in response object: " + response)
        throw (err);
    }).fail(function() {
        var err = new Error(self.uuid + " - Error getting server status: " + error);
        logger.error(err.message);
        throw err;
    });
};

melted.prototype.isConnected = function() {
    var self = this;
    return self.mlt.connected;
};

melted.prototype.initServer = function() {
    var self = this;
    logger.info(self.uuid + " - Connecting to server instance [" + self.mlt.host + ":" + self.mlt.port + "]");

    var deferred = Q.defer();

    var result = self.mlt.connect();

    result.then(function(response) {
        logger.debug(self.uuid + " - Sending command: ULS");
        var aux = self.mlt.sendPromisedCommand("ULS", "201 OK");
        aux.then(function(response) {
            if (response.indexOf("U0") === -1) {
                var err = new Error(self.uuid + " - Unit 0 not found");
                logger.error(err.message);
                deferred.reject(err);
            } else {
                deferred.resolve("OK");
            }
        }, function(error) {
            var err = new Error(self.uuid + " - Could not query Unit status: " + error);
            logger.error(err.message, error);
            deferred.reject(err);
        });
    }, function(error) {
        var err = new Error(self.uuid + " - Could not connect to Melted: " + error);
        logger.error(err.message, error);
        deferred.reject(err);
    });

    return deferred.promise;
};

melted.prototype.stopServer = function() {
    var self = this;
    logger.info(self.uuid + " - Disconnecting from server instance [" + self.mlt.host + ":" + self.mlt.port + "]");

    return self.mlt.disconnect();
};

melted.prototype.sendClip = function(clip, command) {
    var self = this;
    var xml = new melted_xml();

    var type     = clip.type;
    var file     = clip.file;
    var filename = utils.getXmlFileNameFromClip(clip);

    //            var filters = self.config.types[type].filters;

    logger.debug(self.uuid + " - Generating file " + filename);

    logger.debug(self.uuid + " - Adding media [" + file + "] to file " + filename);
    var video = new melted_xml.Producer.Video({ source: file, startFrame: clip.in, length: clip.length });
    xml.push(video);

    logger.debug(self.uuid + " - Creating playlist xml object for file " + filename);
    var pl = new melted_xml.Playlist;
    pl.entry({producer: video});
    xml.push(pl);

    logger.debug(self.uuid + " - Creating track xml object for file " + filename);
    var track = new melted_xml.Multitrack.Track(pl);

    logger.debug(self.uuid + " - Creating multitrack xml object for file " + filename);
    var multitrack = new melted_xml.Multitrack;
    multitrack.addTrack(track);

    logger.debug(self.uuid + " - Creating tractor xml object for file " + filename);
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
    
//    logger.debug("mbc-mosto: [INFO] Adding WebVFX filter", path.resolve(__dirname, 'dynamic-filter.html'));
//    var filterObj = new melted_xml.Filter.WebVFX({resource: path.resolve(__dirname, 'dynamic-filter.html')});
//    tractor.push(filterObj);

    logger.debug("mbc-mosto: [INFO] Adding PNG filter", path.resolve(__dirname, 'demo.png'));
    var filterObj = new melted_xml.Filter.Watermark({resource: path.resolve(__dirname, 'demo.png')});
    tractor.push(filterObj);
    
    logger.debug(self.uuid + " - Pushing xml for file " + filename);
    xml.push(tractor);

    //        var fileName = file.substring(file.lastIndexOf("/") + 1);
    var xmlFile = config.playlists_xml_dir + "/" + filename;

    var deferred = Q.defer();

    logger.debug(self.uuid + " - Writing file " + xmlFile);
    fs.writeFile(xmlFile, xml.toString({pretty:true}), function(err){
        if (err) {
            deferred.reject(err);
        } else {
            logger.debug(self.uuid + " - File ready: " + xmlFile);
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
    
exports = module.exports = function(host, port, timeout) {
    var melted_node_driver = new melted(host, port, timeout);
    return melted_node_driver;
};

