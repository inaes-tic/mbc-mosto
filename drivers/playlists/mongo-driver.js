var config   = require("./conf/mongo-driver"),
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment"),
    mbc      = require('mbc-common'),
    async    = require('async');

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

    console.log("mbc-mosto: [INFO] Creating mongodb playlists driver");

    mongo_driver.prototype.start = function() {
        var db = mbc.db(conf && conf.db);
        var channel = mbc.pubsub();

        self.scheds = db.collection('scheds');
        self.lists = db.collection('lists');

        // these two lines must go, mosto will take care of calling these
        var boundaries = self.validTimes();
        self.readPlaylists(boundaries.from, boundaries.to);

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
        if( self.boundaries ) {
            return self.boundaries;
        } else {
            var now = moment(new Date());
            var until = moment(new Date());
            until.add(config.load_time * 60 * 1000);
            return {
                from: now,
                to: until
            }
        }
    };

    mongo_driver.prototype.setBoundaries = function(from, to) {
        // Notice that if from = to = undefined then boundaries are
        // set to undefined, and settings file is used again
        if( to === undefined ) {
            // assume from = { from: date, to: date }
            var boundaries = from;
            if( boundaries.from === undefined ) {
                // if boundaries = { to: date }, I assume from = now
                boundaries.from = new Date();
            }
            self.boundaries = {
                from: moment(boundaries.from),
                to: moment(boundaries.to)
            };
        } else
            self.boundaries = { from: moment(from), to: moment(to) };
        return self.validTimes()
    };

    mongo_driver.prototype.inTime = function(sched) {
        var boundaries = self.validTimes();
        return (sched.start <= boundaries.to.unix() &&
                sched.end >= boundaries.from.unix());
    };

    mongo_driver.prototype.readPlaylists =  function(from, to, callback) {
        // read playlists from the database

        /*
         * This gets the database's 'scheds' and 'lists' collections
         * and turn them into a mosto.api.Playlist. Then return one by one to callback
         * which defaults to self.newPlaylistCallback
         */

        //console.log("mbc-mosto: [INFO] Start reading playlists from " + config.playlists.to_read);
        var boundaries = self.setBoundaries(from, to);
        self.scheds.findItems({
            start: { $lte: boundaries.to.unix()},
            end: { $gte: boundaries.from.unix() }
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
