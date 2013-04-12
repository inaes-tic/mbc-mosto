var moment = require('moment');
var mongo_driver = require('../drivers/playlists/mongo-driver')
var should = require('should');
var mbc = require('mbc-common');

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

        var playlist = {
            "_id": 1,
	    "models" : [
		{
		    "file" : "./videos/SMPTE_Color_Bars_01.mp4",
		    "durationraw" : "00:30:00",
		    "fps" : 25,
                    "_id" : 1
		},
		{
		    "file" : "./videos/SMPTE_Color_Bars_02.mp4",
		    "durationraw" : "00:30:00",
		    "fps" : 25,
                    "_id" : 2
		},
		{
		    "file" : "./videos/SMPTE_Color_Bars_03.mp4",
		    "durationraw" : "00:30:00",
		    "fps" : 25,
                    "_id" : 3
		},
	    ],
        }

        var schedule = {
	    "title" : "long 2",
	    "list" : 1,
	    "start" : 1365588000,
	    "end" : 1365596786,
	    "allDay" : false,
	    "event" : null,
	    "_id" : 1365625760578
        };

        self.collections = {
            lists: self.db.collection('lists'),
            scheds: self.db.collection('scheds'),
        };

        self.collections.lists.save(playlist, function(err, list) {
            self.collections.scheds.save(schedule, function(err, sched){
                done();
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

    describe('#setBoundaries()', function() {
        beforeEach(function(){
            self.driver.boundaries = undefined;
        });
        it('should exist', function() {
            self.driver.should.have.property('setBoundaries');
            self.driver.setBoundaries.should.be.a('function');
        });
        it('should accept two parameters and save them in boundaries = {from, to}', function() {
            self.driver.setBoundaries(self.from, self.to);
            var boundaries = self.driver.boundaries;
            boundaries.should.have.property('from');
            boundaries.should.have.property('to');
        });
        it('should accept an object', function() {
            self.driver.setBoundaries({from: self.from, to: self.to})
            var boundaries = self.driver.boundaries;
            boundaries.should.have.property('from');
            boundaries.should.have.property('to');
        });
        it('should accept only a "to" object and assume "from" is now', function() {
            self.driver.setBoundaries({to: self.to});
            self.driver.boundaries.should.have.property('from');
        });
        it('should accept dates and transform them to moments', function() {
            self.driver.setBoundaries(new Date(), new Date());
            moment.isMoment(self.driver.boundaries.from).should.be.ok;
            moment.isMoment(self.driver.boundaries.to).should.be.ok;
        });
    });

    describe('#subscriptions', function() {
        before(function() {
            self.pubsub = mbc.pubsub();
        });

        var message = {
            backend: 'schedbackend',
            model: {
                start: moment(new Date()).unix(),
                end: moment(new Date()).add(5*60*1000).unix(),
                _id: 1,
                list: 1,
            },
        };
        this.timeout(10000);
        it('should respond to create messages',function(done){
            // set window from now to 10 minutes
            message.method = 'create';
            self.driver.setBoundaries(new Date(), moment(new Date()).add(10 * 60 * 1000));
            self.driver.registerNewPlaylistListener(function(playlist) {
                playlist.name.should.be.eql(message.model._id);
                moment(playlist.startDate).valueOf().should.eql(message.model.start * 1000);
                done();
            });
            self.pubsub.publish(message);
        });
        it('should respond to update messages', function(done) {
            message.method = 'update';
            self.driver.registerUpdatePlaylistListener(function(playlist) {
                done();
            });
            self.pubsub.publish(message);
        });
        it('should respond to remove messages', function(done) {
            message.method = 'delete';
            self.driver.registerRemovePlaylistListener(function(id) {
                id.should.be.eql(message.model._id);
                done();
            });
            self.pubsub.publish(message);
        });
    });
});
