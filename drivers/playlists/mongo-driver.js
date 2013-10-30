var mbc      = require('mbc-common')
,   config   = mbc.config.Mosto.Mongo
,   mubsub   = require("mubsub")
,   moment   = require("moment")
,   async    = require('async')
,   events   = require ('events')
,   util     = require ('util')
,   logger   = mbc.logger().addLogger('MONGO-DRIVER')
,   models   = require('../../models/Mosto')
,   _        = require('underscore')
,   fs       = require('fs')
;

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

    logger.info("Creating mongodb playlists driver");
}
util.inherits (mongo_driver, events.EventEmitter);

mongo_driver.prototype.start = function() {
    var self = this;
    var db = mbc.db(this.conf && this.conf.db);
    self.channel = mbc.pubsub();

    logger.info("Starting mongo playlists driver");

    self.scheds = db.collection('scheds');
    self.lists = db.collection('lists');
    self.pieces = db.collection('pieces');

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

    logger.info("Stopping mongo playlists driver");

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
                logger.error(err.message);
                return err;
            }
            this.emit('create', playlist);
        }).bind(this));
    },
    'schedbackend.update': function(msg) {
        var self = this;
        this.createPlaylist(msg.model, (function(err, playlist) {
            if( err ) {
                self.emit('error', err);
                logger.error(err.message);
                return err;
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

    logger.debug("getPlaylists", "From: " + window.from.valueOf(), "To: " + window.to.valueOf());

    var query = {};
    query.start = { $lte: window.to.valueOf() };
    query.end = { $gte: window.from.valueOf() };

    self.scheds.findItems(query, function(err, scheds) {
        if( err ) {
            logger.error("Error obtaining playlists: ", err);
            return self.emit('md-error', err);
        }

        if( scheds ) {
            logger.debug("Processing sched list:", scheds);
            async.map(scheds, self.createPlaylist.bind(self), function(err, playlists) {
                if( err ) {
                    logger.error("Error processing playlists: ", err);
                    return self.emit('md-error', err);
                } else {
                    logger.debug("%d Playlists obtained", playlists.length);
                }
                if( callback )
                    callback(playlists);
                else
                    playlists.forEach(function(playlist) {
                        self.emit ("create", playlist);
                    });
            });
        } else {
            logger.debug('No more scheds');
        }
    });
};

mongo_driver.prototype.createPlaylist = function(sched, callback) {
    var self = this;
    logger.debug("Creating Playlist for:", sched);
    self.lists.findById(sched.playlist, function(err, list) {
        if( err ) {
            logger.error("Error obtaining list: ", err);
            callback(err);
            return err;
        }
        logger.debug("LIST:" + list._id);

        logger.info("Processing list:", {"id": list && list._id, "clips": list && list.pieces.length});
        self.pieces.findItems({_id:{"$in": list.pieces}}, function(err, pieces) {
            pieces = _.chain(pieces).map(function(block){
                block._id = (block._id.toHexString && block._id.toHexString()) || block._id;
                return block;
            }).sortBy(function(block){
                return list.pieces.indexOf(block._id);
            }).value();
            var startDate = moment(sched.start);
            var endDate   = moment(sched.end);
            var name = sched.title;
            var playlist_id = (sched._id.toHexString && sched._id.toHexString()) || sched._id;

            var medias = [];
            pieces.forEach(function(block, order) {
                if(!fs.existsSync(block.file)) {
                    self.emit('file-not-found', block.file);
                    return;
                }
                var block_id = (block._id.toHexString && block._id.toHexString()) || block._id;
                var orig_order = order;
                var clip_name = block.name;
                // TODO: don't know what goes in type
                var type = "default";
                var file = block.file;
                var length = moment(block.durationraw, "HH:mm:ss.SSS");
                var fps = block.video.fps;
                medias.push({"id": block_id, "orig_order": orig_order, "playlist_id": playlist_id, "name": clip_name, "type": type, "file": file,
                                      "length": moment.duration({
                                          hours: length.hours(),
                                          minutes: length.minutes(),
                                          seconds: length.seconds(),
                                          milliseconds: length.milliseconds(),
                                      }), "fps": parseFloat(fps)});
            });

            var playlist = new models.Playlist({"id": playlist_id, "name": name, "start": startDate, "end": endDate, "mode": "snap", "medias": medias});

            logger.debug("Created Playlist. name: %s, id: %s, length: %d", playlist.get('name'), playlist.get('id'), playlist.get('medias').length);

            callback(err, playlist);
        });
    });
};

exports = module.exports = function(conf) {
    var driver = new mongo_driver(conf);
    return driver;
};
