var Playlist = require('../../api/Playlist'),
    Media    = require('../../api/Media'),
    mubsub   = require("mubsub"),
    moment   = require("moment"),
    mbc      = require('mbc-common'),
    async    = require('async'),
    events   = require ('events'),
    util     = require ('util'),
    logger   = require('../../logger').addLogger('TEST-DRIVER'),
    _        = require('underscore');


function test_driver(conf) {
    this.conf = conf;
    events.EventEmitter.call (this);

    this.window = {};
    this.co_mode = false;

    logger.info("Creating test playlists driver");
};
util.inherits ( test_driver, events.EventEmitter);

test_driver.prototype.start = function(timeSpan) {
    var self = this;
    self.co_mode = false;
    self.setWindow( { from: moment(), to: moment().add(moment.duration({ hours: 4 })), setWindow: true } );
};

test_driver.prototype.stop = function() {
    var self = this;
    self.co_mode = false;
    self.setWindow( { from: moment(), to: moment().add(moment.duration({ hours: 4 })), setWindow: true } );
};

test_driver.prototype.stop = function() {
    var self = this;
    self.co_mode = false;
    self.setWindow( { from: moment(), to: moment().add(moment.duration({ hours: 4 })), setWindow: true } );
};

test_driver.prototype.setCheckoutMode = function(co_mode) {
    var self = this;
    self.co_mode = co_mode;
}

test_driver.prototype.getPlaylists = function( ops, callback ) {
    var self = this;

    if (self.co_mode)
        return self.getTestPlaylists(ops,callback);

    var playlists = [];
    callback(playlists);
};

test_driver.prototype.getWindow = function( from, to) {
    var window = {
        from: moment(from),
        to: moment(to),
    };
    window.timeSpan = window.to.diff(window.from);
    return window;
};

test_driver.prototype.setWindow = function(from, to) {
    var self = this;
    self.window = self.getWindow(from, to);
    return self.window;
};

test_driver.prototype.TestPlaylist = function( displacement_in_ms ) {
    var playlist = undefined;
    var files =  {  0: "../videos/SMPTE_Color_Bars_01.mp4",
                    1: "../videos/SMPTE_Color_Bars_02.mp4",
                    2: "../videos/SMPTE_Color_Bars_03.mp4" };
    var medias = [];

    for( var i=0; i<3; i++ ) {
        var clip = new Media(  files[i].substring(files[i].lastIndexOf("/") + 1)+"_id", 0, undefined, 1, files[i].substring(files[i].lastIndexOf("/") + 1), "file", files[i], "00:00:30.00", 25 );
        logger.debug("clip " + clip.id + " media:" + clip.file + " length:" + clip.length );
        medias.push(clip);

    }
    if (displacement_in_ms==undefined) displacement_in_ms = 0;
    var startDate = moment().add(moment.duration({ milliseconds: displacement_in_ms })).toDate();
    var endDate = moment( startDate ).add( moment.duration({seconds:90})).toDate();
    playlist = new Playlist( "test_playlist_1_id", "test_playlist_1_name", startDate, medias, endDate, "snap", false );
    return playlist;
};

test_driver.prototype.getTestPlaylists = function( ops, callback ) {
    var playlists = [];

    var playlist = undefined;
    var files =  {  0: "../videos/SMPTE_Color_Bars_01.mp4",
                    1: "../videos/SMPTE_Color_Bars_02.mp4",
                    2: "../videos/SMPTE_Color_Bars_03.mp4" };
    var medias = [];

    for( var i=0; i<3; i++ ) {
        var clip = new Media(  files[i].substring(files[i].lastIndexOf("/") + 1)+"_id", 0, undefined, 1, files[i].substring(files[i].lastIndexOf("/") + 1), "default", files[i], "00:00:30.00", 25 );
        medias.push(clip);
    }

    var startDate = moment().toDate();
    var endDate = moment( startDate ).add( moment.duration({seconds:90})).toDate();
    playlist = new Playlist( "test_pl_1_id", "test_pl_1_name", startDate, medias, endDate, "snap", false );

    playlists.push(playlist);

    callback(playlists);
};


exports = module.exports = function(conf) {
    var driver = new test_driver(conf);
    return driver;
};


