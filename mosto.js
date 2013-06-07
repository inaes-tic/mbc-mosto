var fs               = require('fs')
,   util             = require('util')
,   events           = require('events')
,   moment           = require('moment')
,   Playlist         = require('./api/Playlist')
,   Melted           = require('./api/Melted')
,   Media            = require('./api/Media')
,   ScheduledMedia   = require('./api/ScheduledMedia')
,   StatusClip       = require('./api/StatusClip')
,   mvcp_server      = require('./drivers/mvcp/mvcp-driver')
,   playlists_driver = require('./drivers/playlists/playlists-driver')
,   status_driver    = require('./drivers/status/pubsub')
,   utils            = require('./utils')
,   config           = require('mbc-common').config.Mosto.General
,   _                = require('underscore')
,   heartbeats        = require('./heartbeats')
,   models           = require('./models/Mosto')
;

function mosto(customConfig) {

    /** CONFIGURATION */
    this.config = customConfig || config;
    this.server = undefined;
    this.server_started = false;
    this.pl_driver = undefined;
    this.status_driver = undefined;

    /* MODULES */
    this.heartbeats = undefined;
    this.playlists = undefined;

    events.EventEmitter.call(this);
}

util.inherits(mosto, events.EventEmitter);

mosto.prototype.inTimeWindow = function(obj) {
    // expects obj.start and obj.end to exist and be moment()s
    return (obj.end > this.timeWindow.start && obj.start < this.timeWindow.end);
}

mosto.prototype.initDriver = function() {
    var self = this;
    console.log("mbc-mosto: [INFO] Initializing playlists driver");

    this.pl_driver.on('create', function(playlist) {
        var now = moment();

        if(!self.inTimeWindow(playlist))
            return;

        self.playlists.addPlaylist(playlist);
    });

    this.pl_driver.on('update', function(playlist) {
        if(!self.inTimeWindow(playlist))
            return self.playlists.removePlaylist(playlist);
        return self.playlists.addPlaylist(playlist);
    });

    this.pl_driver.on('delete', function(playlist) {
        return self.playlists.removePlaylist(playlist);
    });

    self.pl_driver.start(self.timeWindow);
};

mosto.prototype.stopDriver = function() {

    console.log("mbc-mosto: [INFO] Stopping playlists driver");

    this.pl_driver.stop();

    this.pl_driver.removeAllListeners("create");
    this.pl_driver.removeAllListeners("update");
    this.pl_driver.removeAllListeners("delete");
};

mosto.prototype.startMvcpServer = function(callback) {
    var self = this;
    var result = self.server.initServer();
    result.then(function() {
        console.log("mbc-mosto: [INFO] MVCP server started");
        self.server_started = true;
        if (callback !== undefined) {
            callback();
        }
    }, function(err) {
        var e = new Error("mbc-mosto: [ERROR] Error starting MVCP server: " + err + ".\nRetrying in 2 seconds...");
        console.error(e);
        setTimeout(function() {
            self.startMvcpServer(callback);
        }, 2000);
    });
};

mosto.prototype.initHeartbeats = function() {
    var self = this;

    console.log("mbc-mosto: [INFO] Initializing heartbeats");

    self.heartbeats.on('frameStatus', function(status) {
        self.status_driver.setStatusClip(StatusClip(
            status.media.id,
            status.media.get('playlist_order'),
            status.media.playlist.id,
            status.media.get('fps'),
            status.frame,
            status.media.get('length')
        ));
    });
    self.heartbeats.on('clipStatus', function(media) {
        var melted_medias = self.playlists.get('melted_medias');
        var playlists = self.playlists.get('playlists');
        var status = {
            clip:{
                previous: undefined,
                current: undefined,
                next: undefined
            },
            show: {
                previous: undefined,
                current: undefined,
                next: undefined
            },
            position: 0,
            clips: melted_medias.toJSON(),
            status: null,
        };
        /* clips */
        var index = melted_medias.indexOf(media);
        status.clip.current = media.toJSON();
        if( index > 0 )
            status.clip.previous = melted_medias.at(index-1).toJSON();
        if( index < melted_medias.length - 1 )
            status.clip.next = melted_medias.at(index+1).toJSON();
        /* shows */
        var playlist = playlists.find(function(pl) {
            return pl.indexOf(media) >= 0;
        });
        index = playlists.indexOf(playlist);
        status.show.current = playlist.toJSON();
        if( index > 0 )
            status.show.previous = playlists.at(index-1).toJSON();
        if( index < playlists.length - 1 )
            status.show.next = playlists.at(index+1).toJSON();
        self.status_driver.setStatus(status);
    });

    self.heartbeats.on("forceCheckout", function(window) {
        self.timeWindow = window;
        self.fetchPlaylists(window);
    });

    self.heartbeats.init();
};

mosto.prototype.fetchPlaylists = function(window) {
    var self = this;
    self.pl_driver.getPlaylists(window, function(playlists) {
        playlists.forEach(function(playlist) {
            self.playlists.get("playlists").add(playlist, {merge: true});
        });
        self.playlists.save();
    });
};

mosto.prototype.getModelPlaylistFromApiPlaylist = function(playlist) {
    //TODO: Remove this function and change driver to send Caspa Models
    var playlistJson   = {};
    playlistJson.name  = playlist.name;
    playlistJson.start = moment(playlist.startDate);
    playlistJson.end   = moment(playlist.endDate);
    playlistJson.id    = playlist.id;

    var start = playlistJson.start;
    var medias = new Mosto.MediaCollection();
    playlist.medias.forEach(function(media) {
        var mediaJson = {};
        mediaJson.playlist_order = media.orig_order;
        mediaJson.name           = media.name;
        mediaJson.type           = media.type;
        mediaJson.file           = media.file;
        //TODO: ASSUMING LENGTH COMES IN SOME KIND OF DATE FORMAT THAT CAN BE USED BY MOMENT
        mediaJson.length         = (moment(media.length) / 1000) * media.fps;
        mediaJson.fps            = media.fps;
        mediaJson.start          = start;
        mediaJson.end            = start + moment(media.length);
        mediaJson.id             = media.id;

        var mostoMedia = new Mosto.Media(mediaJson);
        medias.add(mostoMedia);

        start = start + moment(media.length);
    });

    playlistJson.medias = medias;

    return new Mosto.Playlist(playlistJson);
};

mosto.prototype.stopHeartbeats = function() {
    var self = this;

    console.log("mbc-mosto: [INFO] Stopping heartbeats");

    self.heartbeats.stop();

    self.heartbeats.removeAllListeners("frameStatus");
    self.heartbeats.removeAllListeners("clipStatus");
};

mosto.prototype.init = function( melted, callback) {
    console.log("mbc-mosto: [INFO] Init mbc-mosto... ") ;
    var self = this;
    /*
     * inicializar los drivers
     * inicializar los modelos backbone
     * inicializar los heartbeats
     * linkear los eventos entre pl driver y backbone driver
     * linkear heartbeat con status driver
     */
    function startall() {
        self.server        = new mvcp_server(self.config.mvcp_server);
        console.log("mbc-mosto: [INFO] MVCP Server instantiated: " + self.server.uuid);
        self.pl_driver     = new playlists_driver(self.config.playlist_server);
        self.status_driver = new status_driver();
        self.playlists     = models.Playlists();
        self.heartbeats    = new heartbeats();

        self.timeWindow = { start: moment(), end: moment().add(4, 'hours') };

        self.initDriver();
        self.initHeartbeats();

        self.startMvcpServer( function() {
            //TODO: See why this brakes everything :(
            self.fetchPlaylists({from: moment(), to: moment().add(4, 'hours')});
            if (callback) callback();
        } );
    }

    function check_and_start() {
        Melted.is_running(function(running) {
            if (!running) {
                Melted.start(function(pid) {
                    Melted.setup( undefined, undefined, function(result) {
                        startall();
                    });
                });
            } else {
                startall();
            }
        });
    };

    if (melted!==undefined) {
        Melted = melted;
        check_and_start();
    }
    else
        Melted.take( check_and_start );

};

mosto.prototype.finish = function(callback) {
    console.log("mbc-mosto: [INFO] Finish mbc-mosto... ") ;
    this.stopDriver();
    this.stopHeartbeats();
    Melted.stop(function(pid) {
        setTimeout( function() {
            Melted.leave();
            if (callback) callback();
        }, 1000 );
    });
};

exports = module.exports = function(customConfig) {
    var mosto_server = new mosto(customConfig);
    return mosto_server;
};
/*

  mosto tiene que:

  * inicializar melted
  * inicializar los drivers
  * inicializar los modelos backbone
  * inicializar los heartbeats
  * linkear los eventos entre pl driver y backbone driver
  * linkear heartbeat con status driver

  */
