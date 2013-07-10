var config           = require('mbc-common').config.Mosto.HeartBeats,
    mvcpConfig       = require('mbc-common').config.Mosto.Melted,
    util             = require('util'),
    events           = require('events'), 
    Mosto            = require('./models/Mosto'), 
    moment           = require('moment'),
    fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 
    Q                = require('q'),
    utils            = require('./utils');

/* Events emited
 *  forceCheckout: When medias loaded are less than config time
 *  clipStatus: Every 50 millis aprox
 *  startPlaying: When melted wasnt playing
 *  outOfSync: When melted was more than 1 second defased
 *  hbError: Other errors
 *  noClips: No clips loaded
 */
function heartbeats(customConfig) {
    //THIS MODULE ASSUMES MELTED ALWAYS HAS THE SAME CLIPS AS MELTED_MEDIAS
    //AND THAT THEY ARE IN THE SAME ORDER
    var defaults = {
        gc_interval: 1000 * 60 * 60,
        sync_interval: 50,
        min_scheduled: 1000 * 60 * 60 * 4,
        checkout_interval: undefined,
        mvcp_server: "melted"
    };
    this.config = customConfig || config || defaults;

    if (this.config.checkout_interval === undefined)
        this.config.checkout_interval = this.config.min_scheduled / 4;

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
        }, self.config.checkout_interval);
    }
};

heartbeats.prototype.stop = function() {
    this.stop_timers = true;
};

heartbeats.prototype.checkSchedules =  function() {
    var self = this;
    console.log("[HEARTBEAT-CS] Started Check Schedules");
    var cleanMedias = self.melted_medias.where({blank: false});
    var last = cleanMedias[cleanMedias.length - 1];
    if (last) {
        var scheduled =  last.get('end') - moment();
        if (scheduled < self.config.min_scheduled) {
            self.emit("forceCheckout", {from: last.get('end'), to: last.get('end') + scheduled});
            console.warn("[HEARTBEAT-CS] Sent forceCheckout event!");
        }
    } else {
        self.handleNoMedias();
    }
    self.scheduleCheckout();
    console.log("[HEARTBEAT-CS] Finished Check Schedules");
};

heartbeats.prototype.executeGc = function() {
    var self = this;
    console.log("[HEARTBEAT-GC] Started Garbage Collector");
    var timeLimit = moment().subtract('hours', 1);
    var playlists = Mosto.Playlists().get("playlists");
    var oldPlaylists = playlists.filter(function(media) {
        return moment(media.get('end')) < timeLimit;
    });
    if (oldPlaylists) {
        oldPlaylists.forEach(function(pl) {
            self.removeXml(pl);
            //TODO: Check if it is ok to make this silent
            playlists.remove(pl, {silent: true});
        });
    }
    self.scheduleGc();
    console.log("[HEARTBEAT-GC] Finished Garbage Collector: " + oldPlaylists.length + " playlists removed.");
};

heartbeats.prototype.removeXml = function(playlist) {
    var self = this;
    var baseDir = config.playlists_xml_dir;
    playlist.forEach(function(media) {
        var filename = utils.getXmlFileNameFromClip(media.toJSON());
        var xmlFile = baseDir + "/" + filename;
        fs.unlinkSync(xmlFile, function(err) {
            if (err)
                self.handleError(err);
        });
    });
};

heartbeats.prototype.sendStatus = function() {
    var self = this;
    console.log("[HEARTBEAT-FS] Started Status");
    var expected = self.melted_medias.getExpectedMedia();
    self.emit("clipStatus", expected);
    console.log("[HEARTBEAT-FS] Sent clipStatus");
    self.current_media = expected.media;
    console.log("[HEARTBEAT-FS] Finished Status");
};

heartbeats.prototype.syncMelted = function() {
    console.log("[HEARTBEAT-SY] Start Sync");
    var self = this;
    self.server.getServerStatus().then(function(meltedStatus) {
        var expected = self.melted_medias.getExpectedMedia();
        if (expected.media) {
            var result = Q.resolve();
            var meltedClip = meltedStatus.currentClip;
            if (expected.media.get("id").toString() !== meltedClip.id.toString()) {
                var index = expected.media.get('actual_order');
                var frames = 9999;
                var currentMedia = self.melted_medias.get(meltedClip.id);
                if (currentMedia) {
                    var indexDiff = self.melted_medias.indexOf(currentMedia) - index;
                    if (indexDiff === -1) {
                        // melted's right before the expected media
                        frames = currentMedia.get('out') - meltedClip.currentFrame + expected.frame;
                    } else if (indexDiff === 1) {
                        // melted's right after the expected media
                        frames = meltedClip.currentFrame + (expected.media.get('out') - expected.frame);
                    }
                }

                if (frames > expected.media.get('fps'))
                    result = result.then(function() { return self.fixMelted(expected) });
            } else if (Math.abs(meltedClip.currentFrame - expected.frame) > expected.media.get('fps'))
                result = result.then(function() { return self.fixMelted(expected) });
            if (meltedStatus.status !== "playing") {
                result = result.then(self.startPlaying()).then(self.sendStatus());
            } else {
                result = result.then(self.sendStatus());
            }
            return result;
        } else {
            self.handleNoMedias();
        }
    }).fail(self.handleError.bind(self)).fin(function() {
        self.scheduleSync();
        self.melted_medias.leave();
        console.log("[HEARTBEAT-SY] Finish Sync");
    });
};

heartbeats.prototype.startPlaying = function() {
    var self = this;
    self.emit("startPlaying", "Melted was not playing");
    console.warn("[HEARTBEATS-SY] Melted was not playing");
    return self.server.play();
};

heartbeats.prototype.handleNoMedias = function() {
    var self = this;
    self.emit("noClips", "No medias loaded!");
};

heartbeats.prototype.fixMelted = function(expected) {
    var self = this;
    console.error("[HEARTBEAT-SY] Melted is out of sync!");
    self.emit("outOfSync", expected);
    return self.server.goto(expected.media.get('actual_order'), expected.frame);
};

heartbeats.prototype.handleError = function(error) {
    var self = this;
    console.error(error);
    //NEVER emit 'error' event, see https://github.com/LearnBoost/socket.io/issues/476
    self.emit("hbError", error);
};

exports = module.exports = function(customConfig) {
    var hb = new heartbeats(customConfig);
    return hb;
};
