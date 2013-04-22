var config   = require("mbc-common").config.Mosto.Mongo,
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment"),
    mbc      = require('mbc-common'),
    async    = require('async'),
    events   = require ('events'),
    util     = require ('util'),
    _        = require('underscore');

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

    this.window = {};

    console.log("mongo-driver: [INFO] Creating mongodb playlists driver");
}
util.inherits (mongo_driver, events.EventEmitter);

mongo_driver.prototype.start = function(timeSpan) {
    var self = this;
    var db = mbc.db(this.conf && this.conf.db);
    var channel = mbc.pubsub();

    console.log("mongo-driver: [INFO] Starting mongo playlists driver");

    self.scheds = db.collection('scheds');
    self.lists = db.collection('lists');

    self.setWindow({timeSpan: timeSpan});

    channel.on('JSONmessage', function(chan, msg) {
        var handler = self.pubsub_handler[chan];
        return handler && (handler.bind(self))(msg);
    });
};

mongo_driver.prototype.pubsub_handler = {
    create: function(msg) {
        if( self.inTime(msg.model) ) {
            self.createPlaylist(msg.model, function(err, playlist) {
                if( err )
                    return console.error("mongo-driver [ERROR]:", err);

                self.emit('create', playlist);
            });}},
    update: function(msg) {
        // I forward all create messages
        self.createPlaylist(msg.model, function(err, playlist) {
            if( err )
                return  console.error("mongo-driver [ERROR]:", err);

            self.emit('update', playlist)
        });
    },
    delete: function(msg) {
        self.emit ("delete", msg.model._id);
    },
}

mongo_driver.prototype.getWindow = function(from, to) {
    // Notice that if from = to = undefined then time window is
    // set to undefined, and settings file is used again
    var self = this;
    if( to === undefined ) {
        if( from === undefined ) {
            // use defaults from config file
            var now = moment(new Date());
            var until = moment(new Date());
            var timeSpan = config.load_time * 60 * 1000;
            until.add(timeSpan);
            return {
                from: now,
                to: until,
                timeSpan: timeSpan
            };
        } else {
            // assume from = { from: date, to: date }
            var window = from;
            var ret = _.clone(window);
            if( window.from === undefined ) {
                // I assume from = now
                ret.from = new moment();
            } else {
                ret.from = moment(window.from);
            }
            if( !(window.to || window.timeSpan) ) {
                // if neither is present, we use the currently set
                // value, or default to the config file
                ret.timeSpan = self.window.timeSpan || config.load_time * 60 * 1000;
            }
            if( window.to === undefined ) {
                // we asume timeSpan is present and calculate it
                ret.to = new moment(ret.from);
                ret.to.add(ret.timeSpan);
            } else {
                ret.to = moment(window.to);
            }
            if( ret.timeSpan === undefined ) {
                // if we got here, it means window.to was defined
                // we calculate it using from and to
                ret.timeSpan = ret.to.diff(ret.from);
            } else {
                // this got copied in the _.clone, but it's in minutes
                ret.timeSpan = window.timeSpan * 60 * 1000;
            }
            return ret;
        }
    } else {

        var window = {
            from: moment(from),
            to: moment(to),
        };
        window.timeSpan = window.to.diff(window.from);
        return window;
    }
};

mongo_driver.prototype.setWindow = function(from, to) {
    var self = this;
    self.window = self.getWindow(from, to);
    return self.window;
};

mongo_driver.prototype.inTime = function(sched) {
    var self = this;
    var window = self.getWindow();
    return (sched.start <= window.to.unix() &&
            sched.end >= window.from.unix());
};

mongo_driver.prototype.getPlaylists = function(ops, callback) {
    // read playlists from the database

    /*
     * This gets the database's 'scheds' and 'lists' collections
     * and turn them into a mosto.api.Playlist. Then return one by one to callback
     * which defaults to self.newPlaylistCallback
     */
    var self = this;

    var window;

    if (ops == undefined) {
        window = self.getWindow();
    } else if ( ops.setWindow ) {
        window = self.setWindow(ops.from, ops.to);
    } else {
        window = self.getWindow(ops.from, ops.to);
    }

    console.log("mongo-driver: [INFO] getPlaylists" + window);

    self.scheds.findItems({
        start: { $lte: window.to.unix()},
        end: { $gte: window.from.unix() }
    }, function(err, scheds) {
        if( err ) {
            console.log(err);
        } else if( scheds ) {
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
            self.emit ("error", err);
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
            var actual_order = undefined;
            var clip_name = block.name;
            // TODO: don't know what goes in type
            var type = "default";
            var file = block.file;
            var length = block.durationraw;
            var fps = block.fps;
            medias.push(new Media(block_id, orig_order, actual_order, playlist_id, clip_name, type, file, length, parseFloat(fps)));
        });

        var playlist = new Playlist(playlist_id, name, startDate, medias, endDate, "snap");

        callback(err, playlist);
    });
};

exports = module.exports = function(conf) {
    var driver = new mongo_driver(conf);
    return driver;
};
