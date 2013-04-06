var db;
exports.db = function(config) {
    //var conf = require('config').MediaDB;
    var conf = {
        dbName: "mediadb",
        dbHost: "localhost",
        dbPort: 27017
    };
    db = require('mongoskin').db(conf.dbHost + ':' + conf.dbPort + '/' + conf.dbName + '?auto_reconnect', {safe:true});
    return db;
}
