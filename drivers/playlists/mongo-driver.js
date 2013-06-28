var config   = require("mbc-common").config.Mosto.Mongo
,   Playlist = require('../../api/Playlist')
,   Media    = require('../../api/Media')
,   mubsub   = require("mubsub")
,   moment   = require("moment")
,   mbc      = require('mbc-common')
,   async    = require('async')
,   events   = require ('events')
,   util     = require ('util')
,   _        = require('underscore');

function drop_err(callback, err_handler) {
    return function(err,v) {
        if( !err )
            callback(v);
        else if( err_handler )
            err_handler(err);
    };
}

function mongo_driver(conf) {
    this.conf = conf;
    events.EventEmitter.call (this);

    console.log("mongo-driver: [INFO] Creating mongodb playlists driver");
}
util.inherits (mongo_driver, events.EventEmitter);

mongo_driver.prototype.start = function() {
    var self = this;
    var db = mbc.db(this.conf && this.conf.db);
    self.channel = mbc.pubsub();

    console.log("mongo-driver: [INFO] Starting mongo playlists driver");

    self.scheds = db.collection('scheds');

    self.channel.on('JSONmessage', function(chan, msg) {
        var handler = self.pubsub_handler[chan];
        return handler && (handler.bind(self))(msg);
    });

    self.channel.subscribe('schedbackend.create');
    self.channel.subscribe('schedbackend.update');
    self.channel.subscribe('schedbackend.delete');

};

mongo_driver.prototype.stop = function(timeSpan) {
    var self = this;

    console.log("mongo-driver: [INFO] Stopping mongo playlists driver");

    self.channel.removeAllListeners('JSONmessage');
    self.channel.unsubscribe('schedbackend.create');
    self.channel.unsubscribe('schedbackend.update');
    self.channel.unsubscribe('schedbackend.delete');
    self.channel.end();

};

mongo_driver.prototype.pubsub_handler = {
    'schedbackend.create': function(msg) {
        var self = this;
        this.createPlaylist(msg.model, (function(err, playlist) {
            if( err ) {
                self.emit('error', err);
                return console.error("mongo-driver [ERROR]:", err);
            }
            this.emit('create', playlist);
        }).bind(this));
    },
    'schedbackend.update': function(msg) {
        var self = this;
        this.createPlaylist(msg.model, (function(err, playlist) {
            if( err ) {
                self.emit('error', err);
                return console.error("mongo-driver [ERROR]:", err);
            }
            this.emit('update', playlist);
        }).bind(this));
    },
    'schedbackend.delete': function(msg) {
        this.emit('delete', msg.model._id);
    }
};

mongo_driver.prototype.getPlaylists = function(window, callback) {
    // read playlists from the database

    /*
     * This gets the database's 'scheds' collections
     * and turn them into a mosto.api.Playlist. Then return one by one to callback
     * which defaults to self.newPlaylistCallback
     */
    var self = this;

    console.log("mongo-driver: [INFO] getPlaylists" + window);

    self.scheds.findItems({
        start: { $lte: window.to.unix()},
        end: { $gte: window.from.unix() }
    }, function(err, scheds) {
        if( err ) {
            console.log(err);
            return self.emit('error', err);
        }

        if( scheds ) {
            console.log("Processing sched list:", scheds);
            async.map(scheds, self.createPlaylist.bind(self), function(err, playlists) {
                if( callback )
                    callback(playlists);
                else
                    playlists.forEach(function(playlist) {
                        self.emit ("create", playlist);
                    });
            });
        } else {
            console.log('Done');
        }
    });
};

mongo_driver.prototype.createPlaylist = function(sched, callback) {
    var self = this;
    var err = undefined;
    console.log("mongo-driver: [INFO] Create Playlist:", sched);

    var startDate = moment.unix(sched.start).valueOf();
    var endDate = moment.unix(sched.end).valueOf();
    var name = sched.title;
    var playlist_id = (sched._id.toHexString && sched._id.toHexString()) || sched._id;

    var medias = [];
    _.forEach(sched.list.pieces, function(piece, order) {
        var piece_id = (piece._id.toHexString && piece._id.toHexString()) || piece._id;
        var orig_order = order;
        var clip_name = piece.name;
        // TODO: don't know what goes in type
        var type = "default";
        var file = piece.file;
        var length = moment(piece.durationraw, "HH:mm:ss.SSS");
        var fps = piece.video.fps;
        medias.push(new Media(piece_id, orig_order, playlist_id, clip_name, type, file,
                              moment.duration({
                                  hours: length.hours(),
                                  minutes: length.minutes(),
                                  seconds: length.seconds(),
                                  milliseconds: length.milliseconds(),
                              }), parseFloat(fps)));
    });

    var playlist = new Playlist(playlist_id, name, startDate, medias, endDate, "snap");

    callback(err, playlist);

};

exports = module.exports = function(conf) {
    var driver = new mongo_driver(conf);
    return driver;
};
