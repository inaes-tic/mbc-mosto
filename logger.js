var winston = require('winston'), 
    moment  = require('moment');

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
            maxFiles: 25
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
                    level: 'info',
                    label: category,
                    timestamp: getTimestamp
                }),
                new winston.transports.File({
                    filename: './logs/' + category + '.log',
                    level: 'debug',
                    timestamp: getTimestamp,
                    json: false,
                    maxsize: 102400000,
                    maxFiles: 25
                })
            ]
        });
        winston.loggers.get(category).exitOnError = false;
        return logger.getLogger(category);
    },
    getLogger: function(category) {
        var tmp = {
            error: function(message, metadata) {
                if (metadata) {
                    winston.loggers.get(category).error(message, metadata);
                    general.error("[" + category + "] " + message, metadata);
                } else {
                    winston.loggers.get(category).error(message);
                    general.error("[" + category + "] " + message);
                }
            },
            warn: function(message, metadata) {
                if (metadata) {
                    winston.loggers.get(category).warn(message, metadata);
                    general.warn("[" + category + "] " + message, metadata);
                } else {
                    winston.loggers.get(category).warn(message);
                    general.warn("[" + category + "] " + message);
                }
            },
            info: function(message, metadata) {
                if (metadata) {
                    winston.loggers.get(category).info(message, metadata);
                    general.info("[" + category + "] " + message, metadata);
                } else {
                    winston.loggers.get(category).info(message);
                    general.info("[" + category + "] " + message);
                }
            },
            debug: function(message, metadata) {
                if (metadata) {
                    winston.loggers.get(category).debug(message, metadata);
                    general.debug("[" + category + "] " + message, metadata);
                } else {
                    winston.loggers.get(category).debug(message);
                    general.debug("[" + category + "] " + message);
                }
            }
        };
        return tmp;
    }
};

exports = module.exports = logger;
