var moment = require('moment');
var mongo_driver = require('../drivers/playlists/mongo-driver');
var should = require('should');
var mbc = require('mbc-common');
var _ = require('underscore');

describe('PlaylistMongoDriver', function(){
    var self = this;

    before(function(done) {
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
        self.from = moment(new Date());
        self.to = moment((self.from.unix() + 120 * 60) * 1000); // add 2hs

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

    after(function(done) {
        //
        if(self.collections) {
            for( var col in self.collections) {
                self.collections[col].drop();
            }
        }
        done();
    });

    describe('#setWindow()', function() {
        beforeEach(function(){
            self.driver.window = undefined;
        });
        it('should exist', function() {
            self.driver.should.have.property('setWindow');
            self.driver.setWindow.should.be.a('function');
        });
        it('should accept two parameters and save them in window = {from, to}', function() {
            self.driver.setWindow(self.from, self.to);
            var window = self.driver.window;
            window.should.have.property('from');
            window.should.have.property('to');
        });
        it('should accept an object', function() {
            self.driver.setWindow({from: self.from, to: self.to})
            var window = self.driver.window;
            window.should.have.property('from');
            window.should.have.property('to');
        });
        it('should accept only a "to" object and assume "from" is now', function() {
            self.driver.setWindow({to: self.to});
            self.driver.window.should.have.property('from');
        });
        it('should accept dates and transform them to moments', function() {
            self.driver.setWindow(new Date(), new Date());
            moment.isMoment(self.driver.window.from).should.be.ok;
            moment.isMoment(self.driver.window.to).should.be.ok;
        });
    });

    describe('#subscriptions', function() {
        before(function() {
            self.pubsub = mbc.pubsub();

            self.message = {
                backend: 'schedbackend',
                model: {
                    start: moment(new Date()).unix(),
                    end: moment(new Date()).add(5*60*1000).unix(),
                    _id: self.scheds[0]._id,
                    list: self.lists[0]._id,
                    title: 'title'
                },
                channel: function() { return [this.backend, this.method].join('.') }
            };
        });

        this.timeout(15000);
        it('should respond to create messages',function(done){
            // set window from now to 10 minutes
            var message = self.message;
            message.method = 'create';
            self.driver.setWindow(new Date(), moment(new Date()).add(10 * 60 * 1000));
            self.driver.on('create', function(playlist) {
                playlist.id.should.be.eql(message.model._id);
                playlist.name.should.be.eql(message.model.title);
                moment(playlist.startDate).valueOf().should.eql(message.model.start * 1000);
                done();
            });
            self.pubsub.publish(message);
        });
        it('should respond to update messages', function(done) {
            var message = self.message;
            message.method = 'update';
            self.driver.on('update', function(playlist) {
                done();
            });
            self.pubsub.publish(message);
        });
        it('should respond to remove messages', function(done) {
            var message = self.message;
            message.method = 'delete';
            self.driver.on('delete', function(id) {
                id.should.be.eql(message.model._id);
                done();
            });
            self.pubsub.publish(message);
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
