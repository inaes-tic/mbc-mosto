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

    CaspaDriver.prototype.setupAll = function() {
        var setups = [
            this.setupStatus,
            this.setupMessages,
        ];
        var sendReady = _.after(setups.length, function() {
            self.emit('ready');
        });
        setups.forEach(function(setup){
            setup(sendReady);
        });
    };

    CaspaDriver.prototype.setupStatus = function(callback) {
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
            return {
                name: clip.name,
                _id: clip.id
            }
        }
        var clips = meltedStatus.clips;
        var status = {
            piece: {
                previous: makePiece(clips[meltedStatus.previous]),
                current:  makePiece(clips[meltedStatus.current]),
                next:     makePiece(clips[meltedStatus.next]),
            },
            show: {
                current: { _id: clips[meltedStatus.current].playlist_id },
            },
            on_air: true,
        };
        status.piece.current.progress = meltedStatus.position + "%";

        for( var i in meltedStatus.clips ) {
            if( i < meltedStatus.current ) {
                if( clips[i].playlist_id != status.show.current ) {
                    status.show.previous = { _id: clips[i].playlist_id };
                }
            } else if ( i > meltedStatus.current ) {
                if( clips[i].playlist_id != status.show.current ) {
                    // I'm pass `previous` and the first into `next`, so I'm
                    // done here
                    status.show.next = { _id: clips[i].playlist_id };
                    break;
                }
            }
        }

        this.status = _.extend(this.status, status);
        // except next. If that's undefined, I just don't know!
        this.status.show.next = status.show.next;
        this.publishStatus(status);
    };
    CaspaDriver.prototype.publishStatus = function(status) {
        this.publisher.publish({backend: "mostoStatus", model: status})
    };

    CaspaDriver.prototype.publishMessage = function(code, description, message, sticky) {
        message = new MostoMessage(code, description, message);
        var method = 'emit';
        if( sticky ) {
            // I create an id with the timestamp to be able to cancel the error afterwards
            message.stickId = (new moment()).valueOf();
            method = 'create';
        }
        this.publisher.publish({backend: "mostoMessage", method: method,
                                model: message});
        return message;
    };
    CaspaDriver.prototype.dropMessage = function(message) {
        this.publisher.publish({backend: "mostoMessage", method: 'delete',
                                model: message});
    };
}

util.inherits(CaspaDriver, events.EventEmitter);

exports = module.exports = function() {
    driver = new CaspaDriver();
    driver.setupAll();

    return driver;
};
