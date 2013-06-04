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
,   hearbeats        = require('./heartbeats')
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
}

mosto.prototype.inTimeWindow = function(obj) {
    // expects obj.start and obj.end to exist and be moment()s
    return (obj.end > this.timeWindow.start && obj.start < this.timeWindow.end);
}

mosto.prototype.initDriver = function() {

    console.log("mbc-mosto: [INFO] Initializing playlists driver");

    this.pl_driver.on('create', function(playlist) {
        var now = moment();

        if(!this.inTimeWindow(playlist))
            return;

        this.playlists.addPlaylist(playlist);
    });

    this.pl_driver.on('update', function(playlist) {
        if(!this.inTimeWindow(playlist))
            return this.playlists.removePlaylist(playlist);
        return this.playlists.addPlaylist(playlist);
    });

    self.driver.on ("delete", function(playlist) {
        self.fetcher.removePlaylist( playlist, self.fetcher);
    } );

    self.pl_driver.start();
};

mosto.prototype.stopDriver = function() {

    console.log("mbc-mosto: [INFO] Stopping playlists driver");

    self.driver.stop();

    self.driver.removeAllListeners("create");
    self.driver.removeAllListeners("update");
    self.driver.removeAllListeners("delete");
};

mosto.prototype.startMvcpServer = function(callback) {
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

console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;

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

        // melted is started, get playlist
        self.playlists.get('melted_medias').fetch();

        self.heartbeats.on('frameStatus', function(current_frame) {
            var now = moment();
            var current = self.playlists.get('melted_medias').find(function(media) {
                return media.get('start') <= now && media.get('end') >= now;
            });
            self.status_driver.setStatusClip(StatusClip(
                current.id,
                current.get('playlist_order'),
                current.playlist.id,
                current.get('fps'),
                current_frame,
                current.get('total_frames'),
            ));
        });
        self.heartbeats.on('clipStatus', function(media) {
            var melted_medias = self.playlists.get('melted_medias');
            var playlists = self.playlists.get('playlists');
            var status = {
                clip:{
                    previous: undefined,
                    current: undefined,
                    next: undefined,
                },
                show: {
                    previous: undefined,
                    current: undefined,
                    next: undefined,
                },
                position: 0,
                clips: melted_medias.toJSON(),
                status: none,
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

        self.pl_driver.on('delete');

        self.initDriver();
        self.heartbeats.init();

        self.startMvcpServer( function() {
            self.player.play( self.player );
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

}

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
    util.inherits(mosto, events.EventEmitter);
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
