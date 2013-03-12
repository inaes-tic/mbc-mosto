var melted_node_driver = require("./melted-node-driver"),
    conf               = require("./conf/mvcp-driver");

function mvcp_driver(type) {
    var self = this;
    
    this.server = undefined;
    
    console.log("mbc-mosto: [INFO] Creating server for type [" + type + "]")
    
    if (type === 'melted') {
        this.server = new melted_node_driver(conf.host, conf.port);
    } else {
        var err = new Error("mbc-mosto: [ERROR] Unknown type of server [" + type + "]");
        console.error(err);
        throw err;
    }
    
    mvcp_driver.prototype.initServer = function() {
        return self.server.initServer();
    };
    mvcp_driver.prototype.playPlaylist = function(playlist, callback) {
        self.server.playPlaylist(playlist, callback);
    };
    mvcp_driver.prototype.getServerPlaylist = function(successCallback, errorCallback) {
        return self.server.getServerPlaylist(successCallback, errorCallback);
    };
    mvcp_driver.prototype.getServerStatus = function(successCallback, errorCallback) {
        return self.server.getServerStatus(successCallback, errorCallback);
    };
}

exports = module.exports = function(type) {
    var driver = new mvcp_driver(type);
    return driver;
};
