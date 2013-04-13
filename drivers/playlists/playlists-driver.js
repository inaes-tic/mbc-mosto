var json_driver  = require("./json-driver"),
    mongo_driver = require("./mongo-driver");

exports = module.exports = function(type, config) {
    console.log("playlists-driver: [INFO] Creating playlists driver for type [" + type + "]");

    if (type === 'json') {
        return new json_driver(config);
    } else if (type === 'mongo') {
        return new mongo_driver(config);
    }

    var err = new Error("playlists-driver: [ERROR] Unknown type of driver [" + type + "]");
    console.error(err);
    throw err;
    return null;
};
