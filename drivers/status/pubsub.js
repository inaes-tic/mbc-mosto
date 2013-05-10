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

    console.log("mbc-mosto: [INFO] [STATUS] building status from melted status " );

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
            _id: clip.id
        }
    }

    function makeShow( show, val ) {
        if (show===undefined) return { _id: '' };
        switch(val) {
            case "previous": 
                return { _id: show.previous };
            case "current": 
                return { _id: show.current };
            case "next": 
                return { _id: show.next };
        }
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

    console.log("mbc-mosto: [INFO] [STATUS] status builded. doing last calculations." );

    if (status.piece.current) 
        status.piece.current.progress = meltedStatus.position * 100 + "%";

    /* all of this nonsense is to avoid undefineds. I don't know 
       it's worth the trouble.

       in the end all it's doing is taking out currentFrames from both
       the saved status and the received one, and check if anything changed
    */  
    var currentButFrames = _.omit(status.piece.current, 'currentFrames');
    var statusButFrames = _.chain(status).clone().extend({piece: { current: currentButFrames }})
    var myButFrames = _.omit(this.status.piece.current, 'currentFrames');
    var myStatusButFrames = _.chain(status).clone().extend({ piece: { current: myButFrames } }).value();
    if( statusButFrames.isEqual(myStatusButFrames).value() ) {
        console.log("mbc-mosto: [INFO] [STATUS] no changes, try to send statusclip." );
        return this.setStatusClip(meltedStatus.clip.current);
    }

    this.status = _.extend(this.status, status);
    // except next. If that's undefined, I just don't know!
    this.status.show.next = status.show.next;
    console.log("mbc-mosto: [INFO] [STATUS] finally publish status." );
    this.publish("mostoStatus", status);
};

CaspaDriver.prototype.setStatusClip = function(statusClip) {
    if (statusClip!==undefined)
        this.publish("mostoStatus.progress", {
            currentFrame: statusClip.currentFrame,
            totalFrames: statusClip.totalFrames,
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
