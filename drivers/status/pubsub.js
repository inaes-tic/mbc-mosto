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
var Collections = mbc.config.Common.Collections;
var logger = mbc.logger().addLogger('PUBSUB-DRIVER');
var uuid = require('node-uuid');

var defaults = { // copied from caspa/models.App.Status
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
    this.messagesCollection = this.db.collection(Collections.Mostomessages);
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
    var col = this.db.collection(Collections.Status);
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
    this.messagesCollection.remove(callback);
};

CaspaDriver.prototype.setStatus = function(meltedStatus) {

    logger.debug("Building status from melted status");

    // this overrides this.status with the values passed by status
    function makePiece( melclip, val ) {
        if (melclip===undefined) return { name: '', _id: '' };
        var clip = undefined;
        switch(val) {
        case "previous":
            clip = melclip.previous;
            break;
        case "current":
            clip = melclip.current;
            break;
        case "next":
            clip = melclip.next;
            break;
        }
        if (clip===undefined) return { name: '', _id: '' };
        return {
            name: clip.name,
            _id: clip._id
        }
    }

    function makeShow( shows, val ) {
        if (shows === undefined) return { _id: '' };
        var show = undefined;
        switch(val) {
        case "previous":
            show = shows.previous;
            break;
        case "current":
            show = shows.current;
            break;
        case "next":
            show = shows.next;
            break;
        }
        if( !show ) return {};
        return { _id: show.id };
    }

    var clips = meltedStatus.clips;
    var status = {
        piece: {
            previous: makePiece(meltedStatus.clip, "previous" ),
            current:  makePiece(meltedStatus.clip, "current" ),
            next:     makePiece(meltedStatus.clip, "next" ),
        },
        show: {
            previous: makeShow( meltedStatus.show, "previous"),
            current: makeShow( meltedStatus.show, "current"),
            next: makeShow( meltedStatus.show, "next"),
        },
        on_air: true,
    };

    logger.debug("Status builded. doing last calculations");

    if (status.piece.current)
        status.piece.current.progress = (meltedStatus.position / status.piece.current.length) * 100 + "%";

    var prevStatus = _.clone(this.status);

    this.status = _.extend(this.status, status);
    // except next. If that's undefined, I just don't know!
    this.status.show.next = status.show.next;

    if( _.every(['previous', 'current', 'next'], function(val) {
        return ( status.piece[val]._id == prevStatus.piece[val]._id &&
                 status.show[val]._id == prevStatus.show[val]._id );
    }) ) {
        logger.debug("No changes, try to send statusclip");
        return this.setProgressStatus({
            progress: meltedStatus.position,
            length: meltedStatus.clip.current.length,
        });
    }

    logger.debug("Finally publish status");
    this.publish("mostoStatus", status);
};

CaspaDriver.prototype.setProgressStatus = function(statusPiece) {
    if (statusPiece)
        this.publish("mostoStatus.progress", {
            currentFrame: statusPiece.progress,
            totalFrames: statusPiece.length,
        });
}

CaspaDriver.prototype.publish = function(channel, status) {
    this.publisher.publishJSON(channel, status);
};

CaspaDriver.prototype.publishMessage = function(code, description, message, sticky) {
    message = new MostoMessage(code, description, message);
    var method = 'emit';
    if( sticky ) {
        // I create an id with the timestamp to be able to cancel the error afterwards
        message._id = uuid();
        method = 'create';
        this.messagesCollection.save(message.toJSON(), {safe:false});
    }
    this.publisher.publishJSON(["mostoMessage", method].join('.'),
                               { model: message });
    return message;
};

CaspaDriver.prototype.dropMessage = function(message) {
    this.messagesCollection.remove({_id: message._id});
    this.publisher.publish("mostoMessage.delete", { model: message });
};

exports = module.exports = function() {
    var driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
