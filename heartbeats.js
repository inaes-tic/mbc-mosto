var config           = require('mbc-common').config.Mosto.HeartBeats,
    util             = require('util'),
    events           = require('events'), 
    Mosto            = require('./models/Mosto'), 
    moment           = require('moment'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 
    utils            = require('./utils');

function heartbeats(customConfig) {
    //THIS MODULE ASSUMES MELTED ALWAYS HAS THE SAME CLIPS AS MELTED_MEDIAS 
    //AND THAT THEY ARE IN THE SAME ORDER
    defaults = {
        gc_interval: 1000 * 60 * 60,
        sync_interval: 50,
        min_scheduled: 1000 * 60 * 60 * 4,
        mvcp_server: "melted"
    };
    this.config = customConfig || config || defaults;
    
    this.melted_medias = Mosto.Playlists.get('melted_medias');
    
    this.current_media = false;
    
    this.stop_timers = false;
    
    this.server = new mvcp_server(this.config.mvcp_server);
}

heartbeats.prototype.startMvcpServer = function(callback) {
    var self = this;
    var result = self.server.initServer();
    result.then(function() {
        console.log("[HEARTBEAT-MVCP] MVCP server started");
        if (callback !== undefined) {
            callback();
        }
    }, function(err) {
        var e = new Error("[HEARTBEAT-MVCP] Error starting MVCP server: " + err + ".\nRetrying in 2 seconds...");
        console.error(e);
        setTimeout(function() {
            self.startMvcpServer(callback);
        }, 2000);
    });
};

heartbeats.prototype.init = function() {
    this.startMvcpServer(this.initTimers);    
};

heartbeats.prototype.initTimers = function() {
    var self = this;
    self.scheduleGc();
    self.scheduleSync();
    self.scheduleCheckout();
};

heartbeats.prototype.scheduleGc = function() {
    var self = this;
    if (!self.stop_timers) {
        setTimeout(function() {
            self.executeGc();
        }, self.config.gc_interval);
    }
};

heartbeats.prototype.scheduleSync = function() {
    var self = this;
    if (!self.stop_timers) {
        setTimeout(function() {
            self.melted_medias.take(self.syncMelted.bind(self));
        }, self.config.sync_interval);
    }
};

heartbeats.prototype.scheduleCheckout = function() {
    var self = this;
    if (!self.stop_timers) {
        setTimeout(function() {
            self.checkSchedules();
        }, self.config.min_scheduled / 4);
    }
};

heartbeats.prototype.stop = function() {
    this.stop_timers = true;
};

heartbeats.prototype.checkSchedules =  function() {
    var self = this;
    var last = self.melted_medias.at(self.melted_medias.length - 1);
    var scheduled =  last.get('end') - moment();
    if (scheduled < self.config.min_scheduled)
        self.emit("forceCheckout", scheduled);
};

heartbeats.prototype.executeGc = function() {
    var self = this;
    console.log("[HEARTBEAT-GC] Started Garbage Collector");
    var timeLimit = moment().subtract('hours', 1);
    var oldMedias = self.melted_medias.filter(function(media) {
        return moment(media.get('end')) < timeLimit;
    });
    if (oldMedias) {
        oldMedias.forEach(function(media) {
            self.melted_medias.remove(media);
        });
        self.melted_medias.save();
    }
    self.scheduleGc();
    console.log("[HEARTBEAT-GC] Finished Garbage Collector: " + oldMedias.length + " removed.");
};

heartbeats.prototype.sendStatus = function() {
    var self = this;
    console.log("[HEARTBEAT-FS] Started Status");
//    try {
        var expected = getExpectedMedia();
        if (!self.current_media)
            self.current_media = expected.media;
        if (expected.media.get("id").toString() !== self.current_media.get("id").toString()) {
            self.emit("clipStatus", {old_media: self.current_media, new_media: expected.media, frame: expected.frame});
            self.current_media = expected.media;
        } else {
            self.emit("frameStatus", {media: expected.media, frame: expected.frame});
        }
//    } catch(error) {
//        self.handleError(error);
//    }
    console.log("[HEARTBEAT-FS] Finished Status");
};

heartbeats.prototype.getExpectedMedia = function() {
    var self = this;
    var now = moment();
    var expected = {};
    var media = self.melted_medias.find(function(media) {
        return moment(media.end) >= now;
    });
    if (media) {
        var elapsed = now - moment(media.start);
        var frame = elapsed / media.fps;
        expected.media = media;
        expected.frame = frame;
        return expected;
    } else {
        throw new Error("[HEARTBEAT-SY] Could not find expected clip!");
    }
};

heartbeats.prototype.syncMelted = function() {
    console.log("[HEARTBEAT-SY] Start Sync");
    var self = this;
    self.server.getServerStatus().then(function(meltedStatus) {
//        var deferred = Q.defer();
        if (meltedStatus.status !== "playing") {
//            self.handleError(new Error("[HEARTBEAT-SY] Melted is not playing!"));
//            deferred.reject(new Error("[HEARTBEAT-SY] Melted is not playing!"));
            throw new Error("[HEARTBEAT-SY] Melted is not playing!");
        } else {
//            try {
                var expected = self.getExpectedMedia();
                var meltedClip = meltedStatus.clip;
                if (expected.media.get("id").toString() !== meltedClip.id.toString()) {
                    var index = self.melted_medias.indexOf(expected.media);
                    var frames = 9999;
                    var mediaAbove = self.melted_medias.at(index - 1);
                    if (mediaAbove.get("id").toString() === meltedClip.id.toString()) {
                        frames = meltedClip.length - meltedClip.currentFrame + expected.frame;
                    } else {
                        var mediaBelow = self.melted_medias.at(index + 1);
                        if (mediaBelow.get("id").toString() === meltedClip.id.toString()) {
                            frames = meltedClip.currentFrame + (expected.media.length - expected.frame);
                        }
                    }
                    if (frames > expected.media.fps) {
//                        self.fixMelted(expected);
//                        deferred.resolve(self.fixMelted(expected));
                        return self.fixMelted(expected);
                    } else {
//                        deferred.resolve(self.sendStatus());
                        self.sendStatus();
                    }
                } else if (Math.abs(meltedClip.currentFrame - expected.frame) > expected.media.fps) {
//                    self.fixMelted(expected);
//                    deferred.resolve(self.fixMelted(expected));
                    return self.fixMelted(expected);
                } else {
//                    self.sendStatus();
//                    deferred.resolve(self.sendStatus());
                    self.sendStatus();
                }
//            } catch(err) {
////                self.handleError(err);
//                deferred.reject(err);
//            }            
        }
//        return deferred.promise;
    }).fail(self.handleError).fin(function() {
        self.scheduleSync();
        self.melted_medias.leave();
    });
    console.log("[HEARTBEAT-SY] Finish Sync");
};

heartbeats.prototype.fixMelted = function(expected) {
    console.error("[HEARTBEAT-SY] Melted is out of sync!");
    self.emit("OutOfSync", expected);
    return self.server.goto(expected.media.actual_order, expected.frame).then(self.sendStatus).fail(self.handleError);
};

heartbeats.prototype.handleError =  function(error) {
    console.error(error);
    self.emit("Error", error);
    //FORCING LIST TO SYNC, SHOULD CHECK MELTED PLAYLIST, FIX IT AND START PLAYING
    self.melted_medias.save();
};

exports = module.exports = function(customConfig) {
    util.inherits(heartbeats, events.EventEmitter);
    var hb = new heartbeats(customConfig);
    return hb;
};