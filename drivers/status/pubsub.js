/*******************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 *******************/
events = require('events');
utils = require('utils');
_ = require('underscore');
mbc = require('mbc-common');

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
    ];
    var sendReady = _.times(setups.length, function() {
        self.emit('ready');
    });

    setups.forEach(function(setup){
        setup(sendReady);
    });

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
