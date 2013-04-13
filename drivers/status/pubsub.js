/*******************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 *******************/
var events = require('events');
var util = require('util');
var _ = require('underscore');
var mbc = require('mbc-common');

defaults = { // copied from caspa/models.App.Status
    _id: 2,
    piece: {
        previous: {name: ''},
        current:  {name: '', progress: '0%'},
        next:     {name: ''},
    },
    show: {
        previous: {_id: -1},
        current:  {_id: -1},
        next:     {_id: -1},
    },
    source: null,
    on_air: false,
};

function CaspaDriver() {
    events.EventEmitter.call(this);
    var self = this;
    this.status = _.clone(defaults);
    this.publisher = mbc.pubsub();

    CaspaDriver.prototype.setupAll = function() {
        var setups = [
            this.setupStatus
        ];
        var sendReady = _.after(setups.length, function() {
            self.emit('ready');
        });
        setups.forEach(function(setup){
            setup(sendReady);
        });
    };

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
        this.publishStatus(status);
    };
    CaspaDriver.prototype.publishStatus = function(status) {
        this.publisher.publish({backend: "mostoStatus", model: status})
    };
}

util.inherits(CaspaDriver, events.EventEmitter);

exports = module.exports = function() {
    driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
