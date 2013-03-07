var melted_node_driver = require("./melted-node-driver.js");

function mvcp_driver(type) {
    
    var server;
    
    if (type === 'melted') {
        server = new melted_node_driver();
    } else {
        var err = new Error("mbc-mosto: [ERROR] Unknown type of server [" + type + "]");
        console.error(err);
        throw err;
    }
    
    mvcp_driver.prototype.initServer = function() {
        return server.initServer();
    };
    mvcp_driver.prototype.playPlaylist = function(playlist) {
        server.playPlaylist(playlist);
    };
}

exports = module.exports = function(type) {
    var driver = new mvcp_driver(type);
    return driver;
};
