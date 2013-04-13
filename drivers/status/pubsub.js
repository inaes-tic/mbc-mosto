/*******************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 *******************/
var events = require('events');
var util = require('util');
var _ = require('underscore');
var mbc = require('mbc-common');

defaults = { // copied from caspa/models.App.Status
    _id: 1,
    piece: {
        previous: null,
        curent: null,
        next: null
    },
    show: {
        previous: null,
        current: null,
        next: null,
    },
    source: null,
    no_air: false
};

function CaspaDriver() {
    events.EventEmitter.call(this);
    var self = this;
    this.status = _.clone(defaults);
    this.channel = "mostoStatus";
    this.publisher = mbc.pubsub();

    var setups = [
       self.setupStatus
    ];
    var sendReady = _.times(setups.length, function() {
        self.emit('ready');
    });

    setups.forEach(function(setup){
        setup(sendReady);
    });

    CaspaDriver.prototype.setupStatus = function(callback) {
        var db = mbc.db();
        var col = db.collection('status');
        col.findOne({_id: 1}, function(err, res) {
            if( err )
                // err.. do something?
                return;
            if( !res ) {
                // the status doesn't exist, create it
                col.create(self.status, function(err, itm) {
                    callback();
                });
            } else {
                // res existed, just signal as ready
                callback();
            }
        });
    };

    CaspaDriver.prototype.setStatus = function(status) {
        // this overrides this.status with the values passed by status
        this.status = _.extend(this.status, status);
        this.publish(status);
    };
    CaspaDriver.prototype.publish = function(status) {
        this.publisher.publish({backend: this.channel, model: status});
    };
    CaspaDriver.prototype.publishStatus = function(status) {
        this.publisher.publish({backend: "mostoStatus", model: status})
    };
}

util.inherits(CaspaDriver, events.EventEmitter);

exports = module.exports = function() {
    driver = new CaspaDriver();
    return driver;
};
