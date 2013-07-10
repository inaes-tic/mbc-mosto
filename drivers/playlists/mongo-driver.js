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
    self.lists = db.collection('lists');

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
     * This gets the database's 'scheds' and 'lists' collections
     * and turn them into a mosto.api.Playlist. Then return one by one to callback
     * which defaults to self.newPlaylistCallback
     */
    var self = this;

    console.log("mongo-driver: [INFO] getPlaylists", window);
       
    var query = {};
    query.start = { $lte: window.to.valueOf() };
    query.end = { $gte: window.from.valueOf() };
    
    self.scheds.findItems(query, function(err, scheds) {
        if( err ) {
            console.log(err);
            return self.emit('md-error', err);
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
    console.log("mongo-driver: [INFO] Create Playlist:", sched);
    self.lists.findById(sched.list, function(err, list) {
        if( err ) {
            callback(err);
            return err;
        }

        console.log("mongo-driver: [INFO] Processing list:", list && list._id, list && list.models.length);
        var startDate = new Date(sched.start * 1000);
        var endDate   = new Date(sched.end * 1000);
        var name = sched.title;
        var playlist_id = (sched._id.toHexString && sched._id.toHexString()) || sched._id;

        var medias = [];
        list.models.forEach(function(block, order) {
            var block_id = (block._id.toHexString && block._id.toHexString()) || block._id;
            var orig_order = order;
            var clip_name = block.name;
            // TODO: don't know what goes in type
            var type = "default";
            var file = block.file;
            var length = moment(block.durationraw, "HH:mm:ss.SSS");
            var fps = block.fps;
            medias.push(new Media(block_id, orig_order, playlist_id, clip_name, type, file,
                                  moment.duration({
                                      hours: length.hours(),
                                      minutes: length.minutes(),
                                      seconds: length.seconds(),
                                      milliseconds: length.milliseconds(),
                                  }), parseFloat(fps)));
        });

        var playlist = new Playlist(playlist_id, name, startDate, medias, endDate, "snap");

        callback(err, playlist);
    });
};

exports = module.exports = function(conf) {
    var driver = new mongo_driver(conf);
    return driver;
};
