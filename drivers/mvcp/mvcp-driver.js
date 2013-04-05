var melted_node_driver = require("./melted-node-driver"),
    conf               = require("./conf/mvcp-driver");

function mvcp_driver(type) {
    var self = this;
    
    this.server = undefined;
    
    console.log("mbc-mosto: [INFO] Creating server for type [" + type + "]");
    
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
    mvcp_driver.prototype.getServerPlaylist = function(successCallback, errorCallback) {
        return self.server.getServerPlaylist(successCallback, errorCallback);
    };
    mvcp_driver.prototype.getServerStatus = function(successCallback, errorCallback) {
        return self.server.getServerStatus(successCallback, errorCallback);
    };
    mvcp_driver.prototype.loadClip = function(clip, successCallback, errorCallback) {
        self.server.loadClip(clip, successCallback, errorCallback);
    };
    mvcp_driver.prototype.appendClip = function(clip, successCallback, errorCallback) {
        self.server.appendClip(clip, successCallback, errorCallback);
    };
    mvcp_driver.prototype.insertClip = function(clip, index, successCallback, errorCallback) {
        self.server.insertClip(clip, index, successCallback, errorCallback);
    };
    mvcp_driver.prototype.removeClip = function(index, successCallback, errorCallback) {
        self.server.removeClip(index, successCallback, errorCallback);
    };
    mvcp_driver.prototype.cleanPlaylist = function(successCallback, errorCallback) {
        self.server.cleanPlaylist(successCallback, errorCallback);
    };
//    mvcp_driver.prototype.wipePlaylist = function(successCallback, errorCallback) {
//        self.server.wipePlaylist(successCallback, errorCallback);
//    };
    mvcp_driver.prototype.clearPlaylist = function(successCallback, errorCallback) {
        self.server.clearPlaylist(successCallback, errorCallback);
    };
    mvcp_driver.prototype.moveClip = function(oldIndex, newIndex, successCallback, errorCallback) {
        self.server.moveClip(oldIndex, newIndex, successCallback, errorCallback);
    };
    mvcp_driver.prototype.play = function(successCallback, errorCallback) {
        self.server.play(successCallback, errorCallback);
    };
    mvcp_driver.prototype.stop = function(successCallback, errorCallback) {
        self.server.stop(successCallback, errorCallback);
    };
    mvcp_driver.prototype.pause = function(successCallback, errorCallback) {
        self.server.pause(successCallback, errorCallback);
    };
    mvcp_driver.prototype.goto = function(index, frame, successCallback, errorCallback) {
        self.server.goto(index, frame, successCallback, errorCallback);
    };
}

exports = module.exports = function(type) {
    var driver = new mvcp_driver(type);
    return driver;
};
