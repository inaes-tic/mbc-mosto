var config   = require("./conf/mongo-driver"),
    Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment"),
    mbc      = require('mbc-common');

function mongo_driver() {
    var self = this;

    this.newPlaylistCallback    = undefined;
    this.updatePlaylistCallback = undefined;
    this.removePlaylistCallback = undefined;

    console.log("mbc-mosto: [INFO] Creating mongodb playlists driver");

    mongo_driver.prototype.start = function(config) {
        var db = mbc.db(config && config.db);
        var client = mubsub(db);
        
        var channel = client.channel('messages', { size: 10000000, max: 5000 });

        self.scheds = db.collection('scheds');
        self.lists = db.collection('lists');
        self.readPlaylists();

        channel.subscribe({channel: 'schedbackend', method: 'create'}, function(msg) {
            if( self.inTime(msg.model) ) {
                self.createPlaylist(msg.model, self.newPlaylistCallback);
            }
        });
        channel.subscribe({channel: 'schedbackend', method: 'update'}, function(msg) {
            self.createPlaylist(msg.model, self.updatePlaylistCallback);
        });
        channel.subscribe({channel: 'schedbackend', method: 'delete'}, function(msg) {
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
        if( to === undefined )
            // assume from = { from: date, to: date }
            self.boundaries = from;
        else
            self.boundaries = { from: from, to: to };
        return self.validTimes()
    };

    mongo_driver.prototype.inTime = function(sched) {
        var boundaries = self.validTimes();
        return (sched.start <= boundaries.to.unix() &&
                sched.end >= boundaries.from.unix());
    };

    mongo_driver.prototype.readPlaylists =  function(from, to) {
        // read playlists from the database

        /*
         * This should get the database's 'scheds' and 'lists' collections
         * and turn them into a mosto.api.Playlist
         */
        //console.log("mbc-mosto: [INFO] Start reading playlists from " + config.playlists.to_read);
        var boundaries = self.setBoundaries(from, to);
        self.scheds.findEach({
            start: { $lte: boundaries.to.unix()},
            end: { $gte: boundaries.from.unix() }}, function(err, sched) {
                if( err ) {
                    console.log(err);
                } else if( sched ) {
                    console.log("Processing sched:", sched);
                    self.createPlaylist(sched, self.newPlaylistCallback);
                } else {
                    console.log('Done');
                }
            });
    };
    
    mongo_driver.prototype.createPlaylist = function(sched, callback) {
        self.lists.findById(sched.list, function(err, list) {
            console.log("Processing list:", list);
            var startDate = new Date(sched.start * 1000);
            var endDate   = new Date(sched.end * 1000);
            var name = (sched._id.toHexString && sched._id.toHexString()) || sched._id;

            var medias = [];
            list.models.forEach(function(block) {
                // TODO: don't know what goes in type
                var type = "default";
                var file = block.file;
                var length = block.durationraw;
                var fps = block.fps;
                medias.push(new Media(type, file, length, parseFloat(fps)));
            });
            callback(new Playlist(name, startDate, medias, endDate));
        });
    };
}

exports = module.exports = function() {
    var driver = new mongo_driver();
    return driver;
};
