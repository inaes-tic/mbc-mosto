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
    var defaults = {
        gc_interval: 1000 * 60 * 60,
        sync_interval: 50,
        min_scheduled: 1000 * 60 * 60 * 4,
        mvcp_server: "melted"
    };
    this.config = customConfig || config || defaults;

    this.melted_medias = Mosto.Playlists().get('melted_medias');

    this.current_media = false;
    
    this.stop_timers = false;
    
    this.server = new mvcp_server(this.config.mvcp_server);
    console.log("[HEARTBEAT-MVCP] MVCP server instantiated: " + this.server.uuid);
    
    events.EventEmitter.call(this);
}

util.inherits(heartbeats, events.EventEmitter);

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
    this.startMvcpServer(this.initTimers.bind(this));    
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
        self.emit("forceCheckout", {from: last.get('end'), to: last.get('end') + scheduled});
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
    var expected = getExpectedMedia();
    if (!self.current_media)
        self.current_media = expected.media;
    if (expected.media.get("id").toString() !== self.current_media.get("id").toString()) {
        self.emit("clipStatus", expected.media);
        self.current_media = expected.media;
    } else {
        self.emit("frameStatus", {media: expected.media, frame: expected.frame});
    }
    console.log("[HEARTBEAT-FS] Finished Status");
};

heartbeats.prototype.getExpectedMedia = function() {
    var self = this;
    var now = moment();
    var expected = {};
    var media = self.melted_medias.find(function(media) {
        return moment(media.get('end')) >= now;
    });
    if (media) {
        var elapsed = now - moment(media.get('start'));
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
        if (meltedStatus.status !== "playing") {
            throw new Error("[HEARTBEAT-SY] Melted is not playing!");
        } else {
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
                    return self.fixMelted(expected);
                } else {
                    self.sendStatus();
                }
            } else if (Math.abs(meltedClip.currentFrame - expected.frame) > expected.media.fps) {
                return self.fixMelted(expected);
            } else {
                self.sendStatus();
            }
        }
    }).fail(self.handleError.bind(self)).fin(function() {
        self.scheduleSync();
        self.melted_medias.leave();
    });
    console.log("[HEARTBEAT-SY] Finish Sync");
};

heartbeats.prototype.fixMelted = function(expected) {
    var self = this;
    console.error("[HEARTBEAT-SY] Melted is out of sync!");
    self.emit("outOfSync", expected);
    return self.server.goto(expected.media.actual_order, expected.frame).then(self.sendStatus).fail(self.handleError);
};

heartbeats.prototype.handleError = function(error) {
    var self = this;
    console.error(error);
    //NEVER emit 'error' event, see https://github.com/LearnBoost/socket.io/issues/476
    self.emit("hb_error", error);
    //FORCING LIST TO SYNC, SHOULD CHECK MELTED PLAYLIST, FIX IT AND START PLAYING
//    self.melted_medias.sync();
};

exports = module.exports = function(customConfig) {
    var hb = new heartbeats(customConfig);
    return hb;
};