/***************************************************************************
 * This is the pubsub driver that should tell caspa about the melted status
 *
 * this code is more than slightly coupled with caspa's section that deals
 * with the messages. It should probably be refactored a little, things like
 * creating constants in and handling db collections in mbc-common
 ***************************************************************************/
var events = require('events');
var uuid = require('node-uuid');
var Q = require('q');
var util = require('util');
var _ = require('underscore');
var mbc = require('mbc-common');
var logger = mbc.logger().addLogger('PUBSUB-DRIVER');
var App = require("mbc-common/models/App");

//XXX: keep this as it is here or make a deep copy later.
// _.clone() is shallow.
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

var Status = new App.Status();
Status.bindBackend();
Status.save();

var ProgressStatus = new App.ProgressStatus();
ProgressStatus.bindBackend();
ProgressStatus.save();

var MostoMessagesCollection = new App.MostoMessagesCollection();
MostoMessagesCollection.bindBackend();


function CaspaDriver() {
    events.EventEmitter.call(this);
    var self = this;
    this.status = _.clone(defaults);
    this.db = mbc.db();
    this._initialized = Q.defer();
    this.initialized = this._initialized.promise;
}
util.inherits(CaspaDriver, events.EventEmitter);

CaspaDriver.prototype.CODES = {
    FORCE_CHECKOUT: 101,
    BLANK: 201,
    SYNC: 202,
    PLAY: 203,
    MELTED_NO_CLIPS: 204,
    MELTED_CONN: 501,
    FILE_NOT_FOUND: 502,
    MELTED_SYNC_ERROR: 503,
};

CaspaDriver.prototype.setupAll = function() {
    var self = this;
    var setups = [
        this.setupStatus.bind(this),
        this.setupMessages.bind(this),
    ];
    var sendReady = _.after(setups.length, function() {
        self.emit('ready');
        self._initialized.resolve(true);
    });
    setups.forEach(function(setup){
        setup(sendReady);
    });
};

CaspaDriver.prototype.setupStatus = function(callback) {
    callback();
};

CaspaDriver.prototype.setupMessages = function(callback) {
    MostoMessagesCollection.fetch({
        success: function() {
            callback();
        },
        error: function() {
            callback();
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
            _id: clip._id,
            length: clip.totalFrames,
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
        status.piece.current.progress = (meltedStatus.position / status.piece.current.length) * 100;

    var prevStatus = _.clone(this.status);

    this.status = _.extend(this.status, status);
    // except next. If that's undefined, I just don't know!
    this.status.show.next = status.show.next;

    if( _.every(['previous', 'current', 'next'], function(val) {
        return ( status.piece[val]._id == prevStatus.piece[val]._id &&
                 status.show[val]._id == prevStatus.show[val]._id );
    }) ) {
        logger.debug("No changes, try to send statusclip");
        ProgressStatus.set({
            currentFrame: meltedStatus.position,
            totalFrames: meltedStatus.clip.current.length,
        });
        return ProgressStatus.save();
    }

    logger.debug("Finally publish status");
    Status.set(status);
    return Status.save();
};

/*
  Publishes a message through redis using our iobackends and also saves it
  to mongo.
*/
CaspaDriver.prototype.publishMessage = function(code, message, description, reference) {
    var status = {};
    (code !== undefined) && (status.code = code);
    description && (status.description = description);
    message && (status.message = message);
    reference && (status.reference = reference);

    var existing = MostoMessagesCollection.findWhere(status);
    if(existing) {
        // don't publish the same message twice
        existing.reopen();
        existing.save();
        return existing;
    }


    status._id = uuid.v4();
    status._tmpid = true;
    status = MostoMessagesCollection.create(status);
    status.save();
    return status;
};

/*
  updates the model in the database setting status='fixed' and returns a
  promise that resolves once the object is updated in the database, and the
  signal is published through redis
*/
CaspaDriver.prototype.dropMessage = function(code, reference) {
    var self = this;
    var message = MostoMessagesCollection.findWhere({ code: code, reference: reference });

    if(!message) {
        return Q.resolve(false);
    }

    message.resolve();
    message.unset('_tmpid');

    var defer = Q.defer();
    message.save({
        success: function(model, response, options) {
            defer.resolve(true);
        },
        error: function(model, response, options) {
            defer.reject(response);
        }
    });

    return defer;
};

exports = module.exports = function() {
    var driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
