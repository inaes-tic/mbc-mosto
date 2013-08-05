var melted_node_driver = require("./melted-node-driver"),
    logger             = require('../../logger').addLogger('MVCP-DRIVER'),
    conf               = require('mbc-common').config.Mosto.Melted;

exports = module.exports = function(type) {
    logger.info("Creating server for type [" + type + "]");

    if (type === 'melted') {
        return new melted_node_driver(conf.host, conf.port);
    }
    var err = new Error("Unknown type of server [" + type + "]");
    logger.error(err.message);
    throw err;
    return null;
};
