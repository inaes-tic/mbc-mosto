/*******************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 *******************/

_ = require('underscore');
mbc = require('mbc-common');

defaults = { // copied from caspa/models.App.Status
    _id: 0,
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
    var self = this;
    this.status = _.clone(defaults);
    this.channel = "mosto"
    this.publisher = mbc.JSONredis.createJSONClient();
    
    CaspaDriver.prototype.setStatus = function(status) {
        // this overrides this.status with the values passed by status
        this.status = _.extend(this.status, status);
        this.publish(status);
    };
    CaspaDriver.prototype.publish = function(status) {
        this.publisher.publish(this.channel, status);
    };
}
