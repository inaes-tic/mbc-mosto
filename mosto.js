var fs               = require('fs')
,   util             = require('util')
,   events           = require('events')
,   moment           = require('moment')
,   Playlist         = require('./api/Playlist')
,   Melted           = require('./api/Melted')
,   Media            = require('./api/Media')
,   ScheduledMedia   = require('./api/ScheduledMedia')
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
    
    events.EventEmitter.call(this);
}

util.inherits(mosto, events.EventEmitter);

mosto.prototype.initDriver = function() {
    var self = this;
    console.log("mbc-mosto: [INFO] Initializing playlists driver");

    self.pl_driver.on ("create", function(playlist) {
        var mostoPlaylist = self.getModelPlaylistFromApiPlaylist(playlist);
        self.playlists.get("playlists").add(mostoPlaylist, {merge: true});
        self.playlists.get("melted_medias").sync();
    } );
    self.pl_driver.on ("update", function(playlist) {
        var mostoPlaylist = self.getModelPlaylistFromApiPlaylist(playlist);
        self.playlists.get("playlists").add(mostoPlaylist, {merge: true});
        self.playlists.get("melted_medias").sync();
    } );
    self.pl_driver.on ("delete", function(playlist) {
        self.playlists.get("playlists").remove(playlist.id);
        self.playlists.get("melted_medias").sync();
    } );

    self.pl_driver.start();
};

mosto.prototype.stopDriver = function() {
    var self = this;
    
    console.log("mbc-mosto: [INFO] Stopping playlists driver");

    self.pl_driver.stop();

    self.pl_driver.removeAllListeners("create");
    self.pl_driver.removeAllListeners("update");
    self.pl_driver.removeAllListeners("delete");
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
            status: none
        };
        /* clips */
        var index = melted_medias.indexOf(media);
        status.clip.current = media.toJSON();
        if( index > 0 )
            status.clip.previous = melted_medias.at(index-1).toJSON();
        if( index < melted_medias.length )
            status.clip.next = melted_medias.at(index+1).toJSON();
        /* shows */
        var playlist = playlists.find(function(pl) {
            return pl.indexOf(media) >= 0;
        });
        index = playlists.indexOf(playlist);
        status.show.current = playlist.toJSON();
        if( index > 0 )
            status.show.previous = playlists.at(index-1).toJSON();
        if( index < playlists.length )
            status.show.next = playlists.at(index+1).toJSON();
        self.status_driver.setStatus(status);
    });
    
    self.heartbeats.on("forceCheckout", function(window) {
        self.fetchPlaylists(window);
    });
    self.heartbeats.init();
};
mosto.prototype.fetchPlaylists = function(window) {
    self.driver.getPlaylists(window, function(playlists) {
        playlists.forEach(function(playlist) {
            var mostoPlaylist = self.getModelPlaylistFromApiPlaylist(playlist);
            self.playlists.get("playlists").add(mostoPlaylist, {merge: true});
        });
        self.playlists.get("melted_medias").sync();
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
        self.pl_driver     = new playlists_driver(self.config.playlist_server);
        self.status_driver = new status_driver();
        self.playlists     = models.Playlists;
        self.heartbeats    = new heartbeats();

        self.initDriver();
        self.initHeartbeats();
        
        self.startMvcpServer( function() {
            self.fetchPlaylists({from: now, to: now + (4 * 60 * 60 * 1000)});
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
    self.stopDriver();
    self.player.stop();
    Melted.stop(function(pid) {
        setTimeout( function() {
            Melted.leave();
            if (callback) callback();
        }, 1000 );
    });
}

}

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
