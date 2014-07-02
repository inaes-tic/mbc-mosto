var melted_node = require('melted-node')
,   melted_xml  = require('node-mlt')
,   Status      = require('../../api/Status')
,   StatusClip  = require('../../api/StatusClip')
,   fs          = require('fs')
,   mbc         = require('mbc-common')
,   config      = mbc.config.Mosto.Melted
,   Q           = require('q')
,   utils       = require('../../utils')
,   logger      = mbc.logger().addLogger('MELTED-NODE-DRIVER')
,   melted_log  = mbc.logger().addLogger('MELTED-NODE')
,   uuid        = require('node-uuid')
;

function melted(host, port, timeout) {
    this.uuid = uuid.v4();
    logger.debug(this.uuid + " - Creating server instance [" + host + ":" + port + "]");
    this.mlt = new melted_node(host, port, melted_log, timeout);
    this.commandQueue = Q.resolve();
    logger.debug(this.uuid + " - Server instance created [" + this.mlt.host + ":" + this.mlt.port + "]");
}

melted.prototype._sendCommand = function(command) {
    logger.debug(this.uuid + " - Sending command: " + command);
    return this.mlt.sendCommand(command);
};

melted.prototype.sendCommand = function(command) {
    var self = this;
    var ret = Q.defer();
    this.commandQueue = this.commandQueue.then(function() {
        ret.resolve(self._sendCommand(command));
    });
    return ret.promise;
};

melted.prototype.getServerPlaylist = function() {
    var self = this;
    return this.sendCommand("list u0").then(function(response) {
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
    return this.sendCommand("usta u0").then(function(response) {
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
    return this.mlt.connected;
};

melted.prototype.initServer = function() {
    var self = this;
    logger.info(this.uuid + " - Connecting to server instance [" + this.mlt.host + ":" + this.mlt.port + "]");

    var deferred = Q.defer();

    var result = this.mlt.connect();

    result.then(function(response) {
        var aux = self.sendCommand("ULS");
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
    logger.info(this.uuid + " - Disconnecting from server instance [" + this.mlt.host + ":" + this.mlt.port + "]");

    return this.mlt.disconnect();
};

melted.prototype.sendClip = function(clip, command) {
    var self = this;
    var xml = new melted_xml();

    var type     = clip.type;
    var file     = clip.file;
    var filename = utils.getXmlFileNameFromClip(clip);

    //            var filters = self.config.types[type].filters;

    logger.debug(this.uuid + " - Generating file " + filename);

    logger.debug(this.uuid + " - Adding media [" + file + "] to file " + filename);
    var media = undefined;
    if (clip.type === 'video') {
        media = new melted_xml.Producer.Video({ source: file, startFrame: clip.in, length: clip.length });
    } else if (clip.type === 'image') {
        media = new melted_xml.Producer.Image({ source: file, startFrame: clip.in, length: clip.length });
    } else {
        var err = new Error("Media Type not supported:", clip.type);
        logger.error(err);
        throw err;
    }
        
    xml.push(media);

    logger.debug(this.uuid + " - Creating playlist xml object for file " + filename);
    var pl = new melted_xml.Playlist;
    pl.entry({producer: media});
    xml.push(pl);

    logger.debug(this.uuid + " - Creating track xml object for file " + filename);
    var track = new melted_xml.Multitrack.Track(pl);

    logger.debug(this.uuid + " - Creating multitrack xml object for file " + filename);
    var multitrack = new melted_xml.Multitrack;
    multitrack.addTrack(track);

    logger.debug(this.uuid + " - Creating tractor xml object for file " + filename);
    var tractor = new melted_xml.Tractor;
    tractor.push(multitrack);

    //            console.log("mbc-mosto: [INFO] Creating filter xml objects for file " + filename);
    //            console.log("mbc-mosto: [INFO] Filters: " + filters);
    //            filters.forEach(function(element, index, array){
    //                var filter = this.config.filters[element];
    //                var filterObj = new melted_xml.Filter[filter.filter.charAt(0).toUpperCase() + filter.filter.slice(1)](filter.properties);
    //                console.log("mbc-mosto: [INFO] Adding filter " + filter.filter);
    //                console.log(filter.properties);
    //                tractor.push(filterObj);
    //            });

    logger.debug(this.uuid + " - Pushing xml for file " + filename);
    xml.push(tractor);

    //        var fileName = file.substring(file.lastIndexOf("/") + 1);
    var xmlFile = config.playlists_xml_dir + "/" + filename;

    var deferred = Q.defer();

    logger.debug(this.uuid + " - Writing file " + xmlFile);

    var writeFile = Q.denodeify(fs.writeFile);
    this.commandQueue = Q.all([
        this.commandQueue,
        writeFile(xmlFile, xml.toString({pretty:true})).then(function(){
            logger.debug(self.uuid + " - File ready: " + xmlFile);
        }),
    ]).then(function(){
        logger.debug("Succeded in writing file " + xmlFile);
        deferred.resolve(self._sendCommand(command.replace("{xmlFile}", xmlFile)));
    }, function(err){
        logger.error("Error writing file " + xmlFile, err);
        deferred.reject(err);
    }).thenResolve();

    return deferred.promise;
};

melted.prototype.loadClip = function(clip) {
    //Load clip removing the whole playlist and starting playback
    return this.sendClip(clip, "LOAD U0 {xmlFile}");
};
melted.prototype.appendClip = function(clip) {
    //Appends clip to the end of the playlist
    return this.sendClip(clip, "APND UO {xmlFile}");
};
melted.prototype.insertClip = function(clip, index) {
    //Insert clip at specified index
    return this.sendClip(clip, "INSERT UO {xmlFile} " + index);
};
melted.prototype.removeClip = function(index) {
    //Removes clip at specified index
    return this.sendCommand("REMOVE U0 " + index);
};
melted.prototype.cleanPlaylist = function() {
    //Removes all clips but playing clip
    return this.sendCommand("CLEAN U0");
};
//    melted.prototype.wipePlaylist = function() {
//        //Removes all clips before playing clip
//        return this.sendCommand("WIPE U0");
//    };
melted.prototype.clearPlaylist = function() {
    //Removes all clips, including playing clip
    return this.sendCommand("CLEAR U0");
};
melted.prototype.moveClip = function(oldIndex, newIndex) {
    //Moves the clip at oldIndex to newIndex (use it with getServerPlaylist)
    return this.sendCommand("MOVE U0 " + oldIndex + " " + newIndex);
};
melted.prototype.play = function() {
    //Play
    return this.sendCommand("PLAY U0");
};
melted.prototype.stop = function() {
    //Stop
    return this.sendCommand("STOP U0");
};
melted.prototype.pause = function() {
    //Pause
    return this.sendCommand("PAUSE U0");
};
melted.prototype.goto = function(index, frame) {
    //Starts playing clip at specified index and frame (use with getServerPlaylist and getServerStatus)
    return this.sendCommand("GOTO U0 " + frame + " " + index);
};

exports = module.exports = function(host, port, timeout) {
    var melted_node_driver = new melted(host, port, timeout);
    return melted_node_driver;
};

