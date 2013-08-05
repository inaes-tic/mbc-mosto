var config           = require('mbc-common').config.Mosto.HeartBeats,
    mvcpConfig       = require('mbc-common').config.Mosto.Melted,
    util             = require('util'),
    events           = require('events'), 
    Mosto            = require('./models/Mosto'), 
    moment           = require('moment'),
    fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 
    Q                = require('q'),
    logger           = require('./logger').addLogger('HEARTBEATS'),
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
    logger.debug("MVCP server instantiated: " + this.server.uuid);

    events.EventEmitter.call(this);
}

util.inherits(heartbeats, events.EventEmitter);

heartbeats.prototype.startMvcpServer = function(callback) {
    var self = this;
    var result = self.server.initServer();
    result.then(function() {
        logger.info("MVCP server started");
        if (callback !== undefined) {
            callback();
        }
    }, function(err) {
        logger.error("Error starting MVCP server: " + err + ".\nRetrying in 2 seconds...");
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
    self.stop_timers = false;
    self.scheduleGc();
    self.scheduleSync();
    self.scheduleCheckout();
};

heartbeats.prototype.scheduleGc = function() {
    var self = this;
    setTimeout(function() {
        self.executeGc();
    }, self.config.gc_interval);
};

heartbeats.prototype.scheduleSync = function() {
    var self = this;
    setTimeout(function() {
        self.melted_medias.take(self.syncMelted.bind(self));
    }, self.config.sync_interval);
};

heartbeats.prototype.scheduleCheckout = function() {
    var self = this;
    setTimeout(function() {
        self.checkSchedules();
    }, self.config.checkout_interval);
};

heartbeats.prototype.stop = function() {
    var self = this;
    self.stop_timers = true;
    return self.server.stopServer();
};

heartbeats.prototype.checkSchedules =  function() {
    var self = this;
    if (self.stop_timers)
        return;
    logger.debug("Started Check Schedules");
    var cleanMedias = self.melted_medias.where({blank: false});
    var last = cleanMedias[cleanMedias.length - 1];
    if (last) {
        var scheduled =  last.get('end') - moment();
        if (scheduled < self.config.min_scheduled) {
            self.emit("forceCheckout", {from: last.get('end'), to: last.get('end') + scheduled});
            logger.debug("Sent forceCheckout event!");
        }
    } else {
        self.handleNoMedias();
    }
    self.scheduleCheckout();
    logger.debug("Finished Check Schedules");
};

heartbeats.prototype.executeGc = function() {
    var self = this;
    if (self.stop_timers)
        return;
    logger.debug("Started Garbage Collector");
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
    logger.debug("Finished Garbage Collector: " + oldPlaylists.length + " playlists removed.");
};

heartbeats.prototype.removeXml = function(playlist) {
    //TODO: Rewrite and test this!
//    var self = this;
//    var baseDir = mvcpConfig.playlists_xml_dir;
//    playlist.forEach(function(media) {
//        var filename = utils.getXmlFileNameFromClip(media.toJSON());
//        var xmlFile = baseDir + "/" + filename;
//        fs.unlinkSync(xmlFile, function(err) {
//            if (err)
//                self.handleError(err);
//        });
//    });
};

heartbeats.prototype.sendStatus = function() {
    var self = this;
    logger.debug("Started Status");
    var expected = self.melted_medias.getExpectedMedia();
    self.emit("clipStatus", expected);
    logger.debug("Sent clipStatus");
    self.current_media = expected.media;
    logger.debug("Finished Status");
};

heartbeats.prototype.syncMelted = function() {
    var self = this;
    if (self.stop_timers) {
        self.melted_medias.leave();
        return;
    }
    logger.debug("Start Sync");
    self.server.getServerStatus().then(function(meltedStatus) {
        var expected = self.melted_medias.getExpectedMedia();
        if (expected.media) {
            var result = Q.resolve();
            var meltedClip = meltedStatus.currentClip;
            if (!meltedClip) {
                result = result.then(self.fixMelted(expected));
            } else if (expected.media.get("id").toString() !== meltedClip.id.toString()) {
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
                    result = result.then(self.fixMelted(expected));
            } else if (Math.abs(meltedClip.currentFrame - expected.frame) > expected.media.get('fps'))
                result = result.then(self.fixMelted(expected));
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
        logger.debug("Finish Sync");
    });
};

heartbeats.prototype.startPlaying = function() {
    var self = this;
    self.emit("startPlaying", "Melted was not playing");
    logger.warn("Melted was not playing");
    return self.server.play();
};

heartbeats.prototype.handleNoMedias = function() {
    var self = this;
    self.emit("noClips", "No medias loaded!");
    logger.error("No medias loaded!");
};

heartbeats.prototype.fixMelted = function(expected) {
    var self = this;
    logger.warn("Melted is out of sync!");
    self.emit("outOfSync", expected);
    return self.server.goto(expected.media.get('actual_order'), expected.frame);
};

heartbeats.prototype.handleError = function(error) {
    var self = this;
    logger.error(error.message, error);
    //NEVER emit 'error' event, see https://github.com/LearnBoost/socket.io/issues/476
    self.emit("hbError", error);
};

exports = module.exports = function(customConfig) {
    var hb = new heartbeats(customConfig);
    return hb;
};
