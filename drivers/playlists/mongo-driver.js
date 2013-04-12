var config   = require("./conf/mongo-driver"),
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment"),
    mbc      = require('mbc-common'),
    async    = require('async'),
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
    var self = this;

    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;

    this.window = {};

    console.log("mbc-mosto: [INFO] Creating mongodb playlists driver");

    mongo_driver.prototype.start = function(timeSpan) {
        var db = mbc.db(conf && conf.db);
        var channel = mbc.pubsub();

        self.scheds = db.collection('scheds');
        self.lists = db.collection('lists');

        self.setWindow({timeSpan: timeSpan});

        channel.subscribe({backend: 'schedbackend', method: 'create'}, function(msg) {
            if( self.inTime(msg.model) ) {
                self.createPlaylist(msg.model, drop_err(self.newPlaylistCallback, console.log));
            }
        });
        channel.subscribe({backend: 'schedbackend', method: 'update'}, function(msg) {
            // I forward all create messages
            self.createPlaylist(msg.model, drop_err(self.updatePlaylistCallback, console.log));
        });
        channel.subscribe({backend: 'schedbackend', method: 'delete'}, function(msg) {
            self.removePlaylistCallback(msg.model._id);
        });
    };

    mongo_driver.prototype.registerNewPlaylistListener = function(newPlaylistCallback) {
        self.newPlaylistCallback = newPlaylistCallback;
    };
    mongo_driver.prototype.registerUpdatePlaylistListener = function(updatePlaylistCallback) {
        self.updatePlaylistCallback = updatePlaylistCallback;
    };
    mongo_driver.prototype.registerRemovePlaylistListener = function(removePlaylistCallback) {
        self.removePlaylistCallback = removePlaylistCallback;
    };

    mongo_driver.prototype.validTimes = function() {
        if( self.window ) {
            return self.window;
        } else {
            var now = moment(new Date());
            var until = moment(new Date());
            var timeSpan = config.load_time * 60 * 1000;
            until.add(timeSpan);
            return {
                from: now,
                to: until,
                timeSpan: timeSpan
            };
        }
    };

    mongo_driver.prototype.getWindow = function(from, to) {
        // Notice that if from = to = undefined then time window is
        // set to undefined, and settings file is used again
        if( to === undefined ) {
            // assume from = { from: date, to: date }
            var window = from;
            if( window.from === undefined ) {
                // I assume from = now
                window.from = new moment();
            } else {
                window.from = moment(window.from);
            }
            if( !(window.to || window.timeSpan) ) {
                // if neither is present, we use the currently set
                // value, or default to the config file
                window.timeSpan = self.window.timeSpan || config.load_time * 60 * 1000;
            }
            if( window.to === undefined ) {
                // we asume timeSpan is present and calculate it
                window.to = new moment(window.from);
                window.to.add(window.timeSpan);
            } else {
                window.to = moment(window.to);
            }
            if( window.timeSpan === undefined ) {
                // we calculate it using from and to
                window.timeSpan = window.to.diff(window.from);
            } else {
                // assume we got the timeSpan in minutes
                window.timeSpan *= 60 * 1000;
            }
            return _.clone(window);
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
        self.window = self.getWindow(from, to);
        return self.validTimes()
    };

    mongo_driver.prototype.inTime = function(sched) {
        var window = self.validTimes();
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
        var from = ops.from;
        var to = ops.to;
        var setWindow = ops.setWindow;
        var window = undefined;

        if( setWindow )
            window = self.setWindow(from, to);
        else
            window = self.getWindow(from, to);

        self.scheds.findItems({
            start: { $lte: window.to.unix()},
            end: { $gte: window.from.unix() }
        }, function(err, scheds) {
            if( err ) {
                console.log(err);
            } else if( scheds ) {
                console.log("Processing sched list:", scheds);
                async.map(scheds, self.createPlaylist, function(err, playlists) {
                    if( callback )
                        callback(playlists);
                    else
                        playlists.forEach(function(playlist) {
                            self.newPlaylistCallback(playlist);
                        });
                });
            } else {
                console.log('Done');
            }
        });
    };

    mongo_driver.prototype.createPlaylist = function(sched, callback) {
        self.lists.findById(sched.list, function(err, list) {
            if( err ) {
                if( callback )
                    callback(err);
                return err;
            }

            console.log("Processing list:", list);
            var startDate = new Date(sched.start * 1000);
            var endDate   = new Date(sched.end * 1000);
            var name = sched.name;
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

            var playlist = new Playlist(playlist_id, name, startDate, medias, endDate);

            if( callback )
                callback(err, playlist);
            else
                return playlist;
        });
    };
}

exports = module.exports = function(conf) {
    var driver = new mongo_driver(conf);
    return driver;
};
