var moment = require('moment');
var mongo_driver = require('../drivers/playlists/mongo-driver');
var should = require('should');
var mbc = require('mbc-common');
var _ = require('underscore');
var melted  = require('../api/Melted');

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

                var db_data = require('./playlists/db-data');
                self.lists = db_data.lists;
                self.scheds = db_data.scheds;

                self.collections = {
                    lists: self.db.collection('lists'),
                    scheds: self.db.collection('scheds'),
                };

                var ready = _.after(self.lists.length + self.scheds.length, function(){ done() });

                self.lists.forEach(function(playlist) {
                    playlist._id = self.db.ObjectID(playlist._id);
                    self.collections.lists.save(playlist, function(err, list) {
                        ready();
                    });
                });
                self.scheds.forEach(function(schedule, ix) {
                    var hsix = ix - 3;
                    var now = self.from;
                    // schedules are from 1hs before now
                    var schtime = moment(now + (hsix * 30 * 60 * 1000)).unix();
                    var length = schedule.end - schedule.start;
                    schedule.start = schtime;
                    schedule.end = schtime + length;
                    self.collections.scheds.save(schedule, function(err, sched){
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

    describe('#getWindow()', function() {
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
        it('should accept dates and transform them to moments', function() {
            var window = self.driver.getWindow(new Date(), new Date());
            moment.isMoment(window.from).should.be.ok;
            moment.isMoment(window.to).should.be.ok;
        });
    });

    describe('#subscriptions', function() {
        before(function() {
            self.pubsub = mbc.pubsub();

            self.message = {
                backend: 'schedbackend',
                model: {
                    start: moment().unix(),
                    end: moment().add(5 * 60 * 1000).unix(),
                    _id: self.scheds[0]._id,
                    list: self.lists[0]._id,
                    title: 'title'
                },
                channel: function() { return [this.backend, this.method].join('.') }
            };
        });

        this.timeout(500);
        it('should respond to create messages',function(done){
            // set window from now to 10 minutes
            var message = self.message;
            message.method = 'create';
            self.driver.setWindow(moment(), moment().add(10 * 60 * 1000));
            self.driver.on('create', function(playlist) {
                console.log("create received!" + playlist.name );
                playlist.id.should.be.eql(message.model._id);
                playlist.name.should.be.eql(message.model.title);
                moment(playlist.startDate).valueOf().should.eql(message.model.start * 1000);
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
                return (sched.start <= self.to.unix() &&
                        sched.end >= self.from.unix());
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
