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
		    "file" : "/path/to/file1.avi",
		    "durationraw" : "01:32:18.96",
		    "fps" : 25,
		},
		{
		    "file" : "/path/to.file2.avi",
		    "durationraw" : "00:54:07.16",
		    "fps" : 25,
		}
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

        self.db.collection('lists').save(playlist, function(err, list) {
            self.db.collection('scheds').save(schedule, function(err, sched){
                done();
            });
        });
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
    });
});
