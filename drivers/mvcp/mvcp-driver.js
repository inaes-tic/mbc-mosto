var melted_node_driver = require("./melted-node-driver"),
    conf               = require('mbc-common').config.Mosto.Melted;

exports = module.exports = function(type) {
    console.log("mbc-mosto: [INFO] Creating server for type [" + type + "]");

    if (type === 'melted') {
        return new melted_node_driver(conf.host, conf.port);
    }
    var err = new Error("mbc-mosto: [ERROR] Unknown type of server [" + type + "]");
    console.error(err);
    throw err;
    return null;
};
