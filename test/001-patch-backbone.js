before(function(done) {
    var mbc = require('mbc-common');
    var db            = mbc.db();
    var test_db       = mbc.db( mbc.config.Common.TestingDB );
    var backends_conf = require('../backends.js')(db, test_db);
    var iobackends    = new mbc.iobackends(db, backends_conf);

    iobackends.patchBackbone();

    done();
});
