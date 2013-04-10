var mongo_driver = require('../drivers/playlists/mongo-driver')
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

});
