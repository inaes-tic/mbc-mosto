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
    mvcp_driver.prototype.playPlaylist = function(playlist, callback) {
        self.server.playPlaylist(playlist, callback);
    };
    mvcp_driver.prototype.getServerPlaylist = function(successCallback, errorCallback) {
        return self.server.getServerPlaylist(successCallback, errorCallback);
    };
    mvcp_driver.prototype.getServerStatus = function(successCallback, errorCallback) {
        return self.server.getServerStatus(successCallback, errorCallback);
    };
    mvcp_driver.prototype.loadClip = function(clip, successCallback, errorCallback) {
        //TODO: this loads the clip deleting all loaded clips and starting to play it immediately
    };
    mvcp_driver.prototype.appendClip = function(clip, successCallback, errorCallback) {
        //TODO: this appends the clip to the end of the playlist
    };
    mvcp_driver.prototype.insertClip = function(clip, index, successCallback, errorCallback) {
        //TODO: this inserts a clip into the specified index (use it with getServerPlaylist)
    };
    mvcp_driver.prototype.removeClip = function(index, successCallback, errorCallback) {
        //TODO: this removes a clip at the specified index (use it with getServerPlaylist)
    };
    mvcp_driver.prototype.cleanPlaylist = function(successCallback, errorCallback) {
        //TODO: this removes all clips but the playing clip
    };
    mvcp_driver.prototype.wipePlaylist = function(successCallback, errorCallback) {
        //TODO: this removes all clips before the playing clip
    };
    mvcp_driver.prototype.clearPlaylist = function(successCallback, errorCallback) {
        //TODO: this removes all clips!! DO NOT USE!!
    };
    mvcp_driver.prototype.moveClip = function(oldIndex, newIndex, successCallback, errorCallback) {
        //TODO: this moves the clip at oldIndex to newIndex (use it with getServerPlaylist)
    };
    mvcp_driver.prototype.play = function(successCallback, errorCallback) {
        //TODO: this starts playing the clips loaded into melted (load and append (if nothing loaded) start playing without having to invoke this)
    };
    mvcp_driver.prototype.stop = function(successCallback, errorCallback) {
        //TODO: NEVER USE THIS!!!!
    };
    mvcp_driver.prototype.pause = function(successCallback, errorCallback) {
        //TODO: NEVER USE THIS!!!!
    };
    mvcp_driver.prototype.goto = function(index, frame, successCallback, errorCallback) {
        //TODO: starts playing clip at specified index and frame (use with getServerPlaylist and getServerStatus)
    };
}

exports = module.exports = function(type) {
    var driver = new mvcp_driver(type);
    return driver;
};
