var moment = require('moment');
var mongo_driver = require('../drivers/playlists/mongo-driver');
var should = require('should');
var mbc = require('mbc-common');
var _ = require('underscore');
var helpers = require('./media_helpers');
var test    = require('./test_helper.js')
var Media = require('mbc-common/models/Media');
var uuid = require('node-uuid');

describe('PlaylistMongoDriver', function(){
    var self = this;

    before(function(done) {
        test.take(function() {
            test.init(function(pid){

                // setup mongo driver
                var conf = {
                    db: {
                        dbName: 'mediatestdb',
                        dbHost: 'localhost',
                        dbPort: 27017
                    }
                };
                self.driver = new mongo_driver(conf);

                self.db = mbc.db(conf.db);
                self.db.dropDatabase(function(err, success) {
                    self.driver.start();
                    self.from = moment();
                    self.span = 120;
                    self.to = moment((self.from.unix() + self.span * 60) * 1000); // add 2hs

                    self.collections = {
                        lists: self.db.collection('lists'),
                        scheds: self.db.collection('scheds'),
                        pieces: self.db.collection('pieces'),
                    };

                    var medias = helpers.getJSONMedia();
                    // let's create a playlist at least 1 hour long
                    var playlist = new Media.Playlist({_id: uuid.v1(), title: 'Name'});
                    while(playlist.get('duration') < 3600000) {
                        var m = _.randelem(medias);
                        var piece = new Media.Piece();
                        piece.set('_id', uuid.v1());
                        piece.set('name', m.name);
                        piece.set('file', m.file);
                        piece.set('fps', m.fps);
                        piece.set('durationraw', m.durationraw);
                        playlist.get('pieces').add(piece);
                        playlist.update_duration_nowait(playlist.get('pieces'));
                    }
                    self.pieces = playlist.get('pieces');
                    self.lists = [playlist];
                    // program at least 4hs of schedules
                    self.scheds = [];
                    for(var i = 0 ; i < 5 ; i++) {
                        var schedule = {
                            _id: uuid.v1(),
                            playlist: playlist,
                            title: playlist.get('title') + i,
                        };
                        var hsix = i - 3;
                        var now = self.from;
                        // schedules are from 1hs before now
                        var schtime = moment(now + (hsix * 30 * 60 * 1000)).valueOf();
                        var length = moment.duration(playlist.get('duration'));
                        schedule.start = schtime;
                        schedule.end = schtime + length;
                        var occurrence = new Media.Occurrence(schedule);
                        self.scheds.push(occurrence);
                    };

                    var ready = _.after(
                        self.lists.length + self.pieces.length + self.scheds.length,
                        function(){ done() });

                    self.pieces.forEach(function(piece) {
                        self.collections.pieces.save(piece.toJSON(), {safe:true}, function(err, list) {
                            ready();
                        });
                    });

                    self.lists.forEach(function(playlist) {
                        self.collections.lists.save(playlist.toJSON(), {safe:true}, function(err, list) {
                            ready();
                        });
                    });

                    self.scheds.forEach(function(occurrence) {
                        self.collections.scheds.save(occurrence.toJSON(), {safe:true}, function(err, sched){
                            ready();
                        });
                    });
                    
                });
            });
        });

    });

    after(function(done) {
        //
        if(self.collections) {
            for( var col in self.collections) {
                self.collections[col].drop();
            }
        }
        test.finish(function() {
            test.leave();
            done();
        });
    });

    describe('#subscriptions', function() {
        before(function() {
            self.pubsub = mbc.pubsub();
            var sched = _.randelem(self.scheds);
            var list = sched.get('playlist');
            var model = sched.toJSON();
            model.start = moment().valueOf()
            model.end = moment().add(list.get('duration')).valueOf();
            self.message = {
                backend: 'schedbackend',
                model: model,
                channel: function() { return [this.backend, this.method].join('.') }
            };
        });

        this.timeout(1000);
        it('should respond to create messages',function(done){
            var message = self.message;
            message.method = 'create';
            self.driver.on('create', function(playlist) {
                playlist.id.should.be.eql(message.model._id);
                playlist.get('name').should.be.eql(message.model.title);
                moment(playlist.get('start')).valueOf().should.eql(message.model.start);
                done();
            });
            self.pubsub.publishJSON(message.channel(), message);
        });
        it('should respond to update messages', function(done) {
            var message = self.message;
            message.method = 'update';
            self.driver.on('update', function(playlist) {
                done();
            });
            self.pubsub.publishJSON(message.channel(), message);
        });
        it('should respond to remove messages', function(done) {
            var message = self.message;
            message.method = 'delete';
            self.driver.on('delete', function(id) {
                id.should.be.eql(message.model._id);
                done();
            });
            self.pubsub.publishJSON(message.channel(), message);
        });
    });
    describe("#getPlaylists()", function() {
        it('should return playlists', function(done) {
            self.driver.getPlaylists({from: self.from, to: self.to}, function(playlists) {
                playlists.length.should.not.be.eql(0);
                playlists.forEach(function(pl) {
                    var playlist = pl.toJSON();
                    playlist.should.have.property('id');
                    playlist.should.have.property('name');
                    playlist.should.have.property('start');
                    playlist.should.have.property('medias');
                    playlist.should.have.property('end');
                    playlist.should.have.property('loaded');
                    playlist.should.have.property('mode');
                });
                done();
            });
        });

        it('should return only playlists within timeframe', function(done) {
            var inside = function(sched) {
                return (sched.get('start') <= self.to &&
                        sched.get('end') >= self.from);
            };

            var in_scheds = _.chain(self.scheds).filter(inside).pluck('id').value();
            var out_scheds = _.chain(self.scheds).reject(inside).pluck('id').value();

            self.driver.getPlaylists({from: self.from, to: self.to}, function(playlists) {
                var pl_ids = _.chain(playlists).pluck('id').value();

                pl_ids.forEach(function(playlist, ix) {
                    playlist.should.eql(in_scheds[ix]);
                });
                done();
            });
        });
    });
});
