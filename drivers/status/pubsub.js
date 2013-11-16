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
var Models = require('mbc-common/models/App')
var Collections = mbc.config.Common.Collections;
var logger = mbc.logger().addLogger('PUBSUB-DRIVER');
var uuid = require('node-uuid');
var Q = require('q');

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
    Q.denodeify(this.messagesCollection.findItems)({status: "failing"}).then(function(messages) {
        messages.forEach(function(message) {
            message.status = 'fixed';
            message.end = moment().valueOf();
        });
        return Q.denodeify(this.messagesCollection.save)(messages)
    }).then(callback);

    this.activeMessages = new Models.MessagesCollection();
    this.activeMessages.on('add', function(message) {
        if(message.get('status') != 'failing') {
            this.remove(message);
        }
    });
    this.activeMessages.on('change:status', function(message, value) {
        if(value != 'failing') {
            this.remove(message);
        }
    });
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

/*
  Publishes a message through redis. If the message code is considered an
  ongoing error (such as mosto connectivity errors), it's saved to the database
*/
CaspaDriver.prototype.publishMessage = function(code, message, description, reference) {
    var status = {};
    (code !== undefined) && (status.code = code);
    description && (status.description = description);
    message && (status.message = message);
    reference && (status.reference = reference);

    var existing = this.activeMessages.findWhere(status);
    if(existing) {
        // don't publish the same message twice
        return existing;
    }

    status = new Models.MostoMessage(status);
    var method = 'create';
    status.set('_id', uuid());
    this.messagesCollection.save(status.toJSON(), {safe:false});
    this.activeMessages.add(status);
    this.publisher.publishJSON(["mostoMessage", method].join('.'),
                               { model: status.toJSON() });
    return status;
};

CaspaDriver.prototype.CODES = {
    BLANK: 201,
    SYNC: 202,
    PLAY: 203,
    MELTED_CONN: 501,
    FILE_NOT_FOUND: 502,
};

/*
  updates the model in the database setting status='fixed' and returns a
  promise that resolves once the object is updated in the database, and the
  signal is published through redis
*/
CaspaDriver.prototype.dropMessage = function(code, reference) {
    message = this.activeMessages.findWhere({ code: code, reference: reference });
    if(!this.activeMessages)
        return Q.resolve(false);
    message.set('status', 'fixed');
    assert(!this.activeMessages.get(message));
    message.set('end', moment().valueOf());
    var mobj = message.toJSON();
    return Q.ninvoke(this.messagesCollection, 'findById', mobj._id).then(function() {
        return Q.ninvoke(this.messagesCollection, 'update', {_id: mobj._id}, mobj);
    }).then(function() {
        this.publisher.publish("mostoMessage.update", { model: mobj });
    }).then(function() {
        return true;
    });
};

exports = module.exports = function() {
    var driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
