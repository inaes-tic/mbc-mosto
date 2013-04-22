var json_driver  = require("./json-driver"),
    mongo_driver = require("./mongo-driver");

exports = module.exports = function(type, config) {
    console.log("playlists-driver: [INFO] Creating playlists driver for type [" + type + "]");

    if (type === 'json') {
        return new json_driver(config);
    } else if (type === 'mongo') {
        return new mongo_driver(config);
    }

    /******************************************************************
     * playlists_driver.prototype.setWindow(from, to)
     * this receives either a from=date, to=date or an object that is
     * interpreted as follows:
     * {
     *   from: date,
     *   to: date,
     *   span: int,
     * }
     * span should be in milliseconds
     * if from is absent, it is assumed to be `now`.
     * if either one of `to` or `span` is be present, the missing one is calculated
     * using `from` and the other one thus:
     * span = (to - from) // this is in miliseconds
     * to = from + span
     * if both are absent, the config file is used to get the span value
     * it returns the window object with the structure above (always complete)
     *******************************************************************/
    /******************************************************************
     * playlists_driver.prototype.getPlaylists(ops, callback)
     * ops is 
     * {
     *    from: date
     *    to: date
     *    setWindow: boolean
     * }
     * with the same description as in setWindow
     ******************************************************************/

    var err = new Error("playlists-driver: [ERROR] Unknown type of driver [" + type + "]");
    console.error(err);
    throw err;
    return null;
};
