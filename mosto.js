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
//TODO: Chequear window, se esta construyendo de formas distintas
//INCLUSO EN EL DRIVER MISMO SE USA DE FORMAS DISTINTAS!!!
function mosto(customConfig) {

    /** CONFIGURATION */
    this.config         = customConfig || config;
    this.server         = undefined;
    this.server_started = false;
    this.pl_driver      = undefined;
    this.status_driver  = undefined;
    this.timeWindow     = undefined;

    /* MODULES */
    this.heartbeats = undefined;
    this.playlists  = undefined;

    events.EventEmitter.call(this);
}

util.inherits(mosto, events.EventEmitter);

mosto.prototype.inTimeWindow = function(obj) {
    // expects obj.start and obj.end to exist and be moment()s
    return (obj.end > this.timeWindow.from && obj.start < this.timeWindow.to);
};

mosto.prototype.addPlaylist = function(playlist) {
    var self = this;

    if(self.inTimeWindow(playlist))
        self.playlists.addPlaylist(playlist);
};

mosto.prototype.initDriver = function() {
    var self = this;
    console.log("mbc-mosto: [INFO] Initializing playlists driver");

    this.pl_driver.on('create', function(playlist) {
        self.addPlaylist(playlist);
    });

    this.pl_driver.on('update', function(playlist) {
        if(!self.inTimeWindow(playlist))
            self.playlists.removePlaylist(playlist);
        else
            self.addPlaylist(playlist);
    });

    this.pl_driver.on('delete', function(playlist) {
        self.playlists.removePlaylist(playlist);
    });

    self.pl_driver.start();
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

    self.heartbeats.on('clipStatus', function(status) {
        var media = status.media;
        var frame = status.frame;
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
        var playlist = playlists.get(media.get('playlist_id'));
        if( playlist ) {
            index = playlists.indexOf(playlist);
            status.show.current = playlist.toJSON();
            if( index > 0 )
                status.show.previous = playlists.at(index-1).toJSON();
            if( index < playlists.length - 1 )
                status.show.next = playlists.at(index+1).toJSON();
        }
        self.status_driver.setStatus(status);
    });

    self.heartbeats.on("forceCheckout", function(window) {
        self.timeWindow = window;
        self.fetchPlaylists(window);
    });

    self.heartbeats.on("noClips", function() {
        var window = {from: moment(), to: moment().add(4, 'hours')};
        self.timeWindow = window;
        self.fetchPlaylists(window);
    });

    self.heartbeats.init();
};

mosto.prototype.fetchPlaylists = function(window) {
    var self = this;
    if (!window)
        window = self.timeWindow;
    self.pl_driver.getPlaylists(window, function(playlists) {
        playlists.forEach(function(playlist) {
            self.playlists.get("playlists").add(playlist, {merge: true});
        });
        self.playlists.save();
    });
};

mosto.prototype.stopHeartbeats = function() {
    var self = this;

    console.log("mbc-mosto: [INFO] Stopping heartbeats");

    self.heartbeats.stop();

    self.heartbeats.removeAllListeners("frameStatus");
    self.heartbeats.removeAllListeners("clipStatus");
    self.heartbeats.removeAllListeners("forceCheckout");
    self.heartbeats.removeAllListeners("noClips");
};

mosto.prototype.init = function(melted, callback) {
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
        self.timeWindow    = {from: moment(), to: moment().add(4, 'hours')};

        self.initDriver();
        self.initHeartbeats();

        self.startMvcpServer( function() {
            self.fetchPlaylists({from: moment(), to: moment().add(4, 'hours')});
            self.emit('started', 'Mosto has started');
            if (callback) callback();
        } );
    }

    function check_and_start() {
        Melted.is_running(function(running) {
            if (!running) {
                Melted.start(function(pid) {
                    Melted.setup(undefined, undefined, function(result) {
                        startall();
                    });
                });
            } else {
                startall();
            }
        });
    };

    if (melted !== undefined) {
        Melted = melted;
        check_and_start();
    }
    else
        Melted.take(check_and_start);

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
