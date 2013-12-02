var semaphore = require('semaphore')(1)
,   melted    = require('../api/Melted')
,   Mosto     = require('../models/Mosto')
;


exports.take = function() {
    return semaphore.take.apply(this, arguments);
};

exports.leave = function() {
    return semaphore.leave.apply(this, arguments);
};

exports.init = function(callback) {
    melted.stop(function(){
        melted.start(function(pid) {
            melted.setup(undefined, undefined, function(has_err) {
                callback();
            });
        });
    });
};

exports.finish = function(callback) {
    melted.stop(callback);
};