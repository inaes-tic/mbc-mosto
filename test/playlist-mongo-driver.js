var moment = require('moment');
var mongo_driver = require('../drivers/playlists/mongo-driver');
var should = require('should');
var mbc = require('mbc-common');
var _ = require('underscore');
var melted  = require('../api/Melted');
var helpers = require('./media_helpers');
var Media = require('mbc-common/models/Media');
var uuid = require('node-uuid');

describe('PlaylistMongoDriver', function(){
    var self = this;

    before(function(done) {
        melted.take(function() {
            melted.stop(function(pid){

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
                self.driver.start();
                self.from = moment();
                self.span = 120;
                self.to = moment((self.from.unix() + self.span * 60) * 1000); // add 2hs

                self.collections = {
                    lists: self.db.collection('lists'),
                    scheds: self.db.collection('scheds'),
                    pieces: self.db.collection('pieces'),
                };

                var medias = helpers.getMBCMedia();
                // let's create a playlist at least 1 hour long
                var playlist = new Media.Playlist({_id: uuid.v1()});
                playlist.set('title', 'TestPlaylist');
                while(playlist.get('duration') < 3600000) {
                    var media = _.randelem(medias);
                    var piece = new Media.Piece(media.toJSON());
                    piece.set('_id', uuid.v1());
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
                    var schtime = moment(now + (hsix * 30 * 60 * 1000));
                    var length = moment.duration(playlist.get('duration'));
                    schedule.start = schtime.valueOf();
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

    after(function(done) {
        //
        if(self.collections) {
            for( var col in self.collections) {
                self.collections[col].drop();
            }
        }
        melted.leave();
        done();
    });

    describe.skip('#getWindow()', function() {
        beforeEach(function(){
            self.driver.window = undefined;
        });
        it('should exist', function() {
            self.driver.should.have.property('getWindow');
            self.driver.getWindow.should.be.a('function');
        });
        it('should accept two parameters and save them in window = {from, to}', function() {
            var window = self.driver.getWindow(self.from, self.to);
            window.from.valueOf().should.equal(self.from.valueOf());
            window.to.valueOf().should.equal(self.to.valueOf());
        });
        it('should accept an object with {from, to}', function() {
            var window = self.driver.getWindow({from: self.from, to: self.to});
            window.from.valueOf().should.equal(self.from.valueOf());
            window.to.valueOf().should.equal(self.to.valueOf());
        });
        it('should accept an object with {from, timeSpan}', function() {
            var window = self.driver.getWindow({from: self.from, timeSpan: self.span});
            window.from.valueOf().should.equal(self.from.valueOf());
            var to = moment(self.from.valueOf());
            to.add(self.span * 60 * 1000);
            console.log('popop', window.to.valueOf(), to.valueOf())
            window.to.valueOf().should.equal(to.valueOf());
        });
        it('should accept only a "to" object and assume "from" is now', function() {
            var window = self.driver.getWindow({to: self.to});
            window.should.have.property('from');
            window.from.valueOf().should.approximately((new moment()).valueOf(), 10);
        });
        it('should accept no parameters, and use the config file from defaults', function(){
            var window = self.driver.getWindow();
            var config = require('mbc-common').config.Mosto.Mongo;
            window.timeSpan.should.equal(config.load_time * 60 * 1000);
            window.from.valueOf().should.approximately(moment().valueOf(), 10);
            window.to.diff(window.from).valueOf().should.equal(window.timeSpan.valueOf());
        });
        it('should accept dates and transform them to moments', function() {
            var window = self.driver.getWindow(new Date(), new Date());
            moment.isMoment(window.from).should.be.ok;
            moment.isMoment(window.to).should.be.ok;
        });
    });

    describe('#subscriptions', function() {
        before(function() {
            self.pubsub = mbc.pubsub();
            var sched = _.randelem(self.scheds);
            var list = sched.get('playlist');
            var model = sched.toJSON();
            model.start = moment().valueOf()
            model.end = moment().add(list.get('duration'));
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
                console.log("create received! - " + playlist.name );
                playlist.id.should.be.eql(message.model._id);
                playlist.name.should.be.eql(message.model.title);
                playlist.start.should.eql(message.model.start);
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
                playlists.forEach(function(playlist) {
                    playlist.should.have.property('id');
                    playlist.should.have.property('name');
                    playlist.should.have.property('startDate');
                    playlist.should.have.property('medias');
                    playlist.should.have.property('endDate');
                    playlist.should.have.property('loaded');
                });
                done();
            });
        });

        it('should return only playlists within timeframe', function(done) {
            var inside = function(sched) {
                return (sched.get('start') <= self.to.valueOf() &&
                        sched.get('end') >= self.from.valueOf());
            };
            var sched_id = function(sched) {
                return sched._id;
            };

            var in_scheds = _.chain(self.scheds).filter(inside).map(sched_id).value();
            var out_scheds = _.chain(self.scheds).reject(inside).map(sched_id).value();

            self.driver.getPlaylists({from: self.from, to: self.to}, function(playlists) {
                var pl_ids = _.chain(playlists).map(function(pl) { return pl.id }).value();

                pl_ids.forEach(function(playlist, ix) {
                    playlist.should.eql(in_scheds[ix]);
                });
                done();
            });
        });
    });
});
