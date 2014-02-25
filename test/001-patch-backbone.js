before(function(done) {
    var mbc = require('mbc-common');
    var db            = mbc.db();
    var backends_conf = require('../backends.js')(db);
    var iobackends    = new mbc.iobackends(db, backends_conf);

    iobackends.patchBackbone();

    done();
});
