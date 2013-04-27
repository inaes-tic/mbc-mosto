/***************************************************************************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 * this code is more than slightly coupled with caspa's section that deals
 * with the messages. It should probably be refactored a little, things like
 * creating constants in and handling db collections in mbc-common
 ***************************************************************************/
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

function MostoMessage(value, description, message) {
    this.value = value;
    this.description = description;
    this.message = message;
}

function CaspaDriver() {
    events.EventEmitter.call(this);
    var self = this;
    this.status = _.clone(defaults);
    this.db = mbc.db();
    this.publisher = mbc.pubsub();
}
util.inherits(CaspaDriver, events.EventEmitter);

CaspaDriver.prototype.setupAll = function() {
    var self = this;
    var setups = [
        this.setupStatus.bind(this),
        this.setupMessages.bind(this),
    ];
    var sendReady = _.after(setups.length, function() {
        self.emit('ready');
    });
    setups.forEach(function(setup){
        setup(sendReady);
    });
};

CaspaDriver.prototype.setupStatus = function(callback) {
    var self = this;
    var col = this.db.collection('status');
    col.findOne({_id: 2}, function(err, res) {
        if( err )
            // err.. do something?
            return;
        if( !res ) {
            // the status doesn't exist, create it
            col.save(self.status, function(err, itm) {
                callback();
            });
        } else {
            // res existed, just signal as ready
            callback();
        }
    });
};

CaspaDriver.prototype.setupMessages = function(callback) {
    // I think we should assume at init there's no sticky errors?
    this.db.collection('mostomessages').remove(callback);
};

CaspaDriver.prototype.setStatus = function(meltedStatus) {
    // this overrides this.status with the values passed by status
    function makePiece(clip) {
        if (clip===undefined) return { name: '', _id: '' };
        return {
            name: clip.name,
            _id: clip.id
        }
    }

    var clips = meltedStatus.clips;
    var status = {
        piece: {
            previous: makePiece(meltedStatus.clip.previous),
            current:  makePiece(meltedStatus.clip.current),
            next:     makePiece(meltedStatus.clip.next),
        },
        show: {
            previous: { _id: meltedStatus.show.previous },
            current: { _id: meltedStatus.show.current },
            next: { _id: meltedStatus.show.next },
        },
        on_air: true,
    };
    status.piece.current.progress = meltedStatus.position * 100 + "%";

    this.status = _.extend(this.status, status);
    // except next. If that's undefined, I just don't know!
    this.status.show.next = status.show.next;
    this.publish("mostoStatus", status);
};

CaspaDriver.prototype.setStatusClip = function(statusClip) {}

CaspaDriver.prototype.publish = function(channel, status) {
    this.publisher.publishJSON(channel, status);
};

CaspaDriver.prototype.publishMessage = function(code, description, message, sticky) {
    message = new MostoMessage(code, description, message);
    var method = 'emit';
    if( sticky ) {
        // I create an id with the timestamp to be able to cancel the error afterwards
        message.stickId = (new moment()).valueOf();
        method = 'create';
    }
    this.publisher.publishJSON(["mostoMessage", method].join('.'),
                               { model: message });
    return message;
};

CaspaDriver.prototype.dropMessage = function(message) {
    this.publisher.publish("mostoMessage.delete", { model: message });
};

exports = module.exports = function() {
    var driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
