var winston = require('winston'), 
    moment  = require('moment'), 
    level   = process.env.MBC_CONSOLE_LOG_LEVEL || 'info';

/* LEVELS WE CAN USE
silly: 0,
debug: 1,
verbose: 2,
info: 3,
warn: 4,
error: 5
*/

var getTimestamp = function() {
    return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
};

var general = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            filename: './logs/general.log',
            handleExceptions: true,
            level: 'debug',
            timestamp: getTimestamp,
            json: false,
            maxsize: 102400000,
            maxFiles: 5
        })
    ],
    exitOnError: false
});

var logger = {
    addLogger: function(category) {
        winston.loggers.add(category, {
            transports: [
                new winston.transports.Console({
                    colorize: true,
                    level: level,
                    label: category,
                    timestamp: getTimestamp
                }),
                new winston.transports.File({
                    filename: './logs/' + category + '.log',
                    level: 'debug',
                    timestamp: getTimestamp,
                    json: false,
                    maxsize: 102400000,
                    maxFiles: 5
                })
            ]
        });
        winston.loggers.get(category).exitOnError = false;
        return logger.getLogger(category);
    },
    getLogger: function(category) {
        var _wlogger = winston.loggers.get(category);
        var _label = "[" + category + "] ";
        var tmp = {
            _getArguments: function() {
                var args = Array.prototype.slice.call(arguments);
                return args;
            },
            error: function() {
                var args = this._getArguments.apply(this, arguments);
                _wlogger.error.apply(_wlogger, args);
                args[0] = _label + args[0];
                general.error.apply(general, args);
            },
            warn: function(message) {
                var args = this._getArguments.apply(this, arguments);
                _wlogger.warn.apply(_wlogger, args);
                args[0] = _label + args[0];
                general.warn.apply(general, args);
            },
            info: function(message) {
                var args = this._getArguments.apply(this, arguments);
                _wlogger.info.apply(_wlogger, args);
                args[0] = _label + args[0];
                general.info.apply(general, args);
            },
            debug: function(message) {
                var args = this._getArguments.apply(this, arguments);
                _wlogger.debug.apply(_wlogger, args);
                args[0] = _label + args[0];
                general.debug.apply(general, args);
            }
        };
        return tmp;
    }
};

exports = module.exports = logger;
