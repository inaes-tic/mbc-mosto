var fs               = require('fs'),
    util             = require('util'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'),
    playlists_driver = require('./drivers/playlists/playlists-driver'),
    status_driver    = require('./drivers/status/pubsub'),
    utils            = require('./utils'),
    config           = require('mbc-common').config.Mosto.General,
    _                = require('underscore'),
    mosto_fetcher    = require('./fetch'),
    mosto_scheduler  = require('./scheduler'),
    mosto_synchronizer  = require('./sync'),
    mosto_player  = require('./play');
/*
// SILENCE LOG OUTPUT
var util = require('util');
var fs = require('fs');
var log = fs.createWriteStream('./stdout.log');

console.log = console.info = function(t) {
  var out;
  if (t && ~t.indexOf('%')) {
    out = util.format.apply(util, arguments);
    process.stdout.write(out + '\n');
    return;
  } else {
    out = Array.prototype.join.call(arguments, ' ');
  }
  out && log.write(out + '\n');
};
// END SILENCE LOG OUTPUT
*/

function mosto(customConfig) {

    /** CONFIGURATION */
    this.config = customConfig || config;
    this.server = undefined;
    this.server_started = false;
    this.driver = undefined;
    this.status_driver = undefined;

    var self = this;

    mosto.prototype.initDriver = function() {

        console.log("mbc-mosto: [INFO] Initializing playlists driver");

        self.driver.on ("create", function(playlist) {

            self.fetcher.addPlaylist( playlist, self.fetcher );
        } );
        self.driver.on ("update", function(playlist) {
            self.fetcher.updatePlaylist( playlist, self.fetcher);
        } );
        self.driver.on ("delete", function(playlist) {
            self.fetcher.removePlaylist( playlist, self.fetcher);
        } );

        self.driver.start();
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

    /* MODULES */
    this.fetcher = undefined; //retreive lists from playlist driver data source
    this.scheduler = undefined; //convert playlists fetched in a scheduled list of clips
    this.synchronizer = undefined; //synchronize scheduled playlist with server playlist
    this.player = undefined; // timer that calls upstream all modules

    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;

    mosto.prototype.init = function( melted, callback) {
        console.log("mbc-mosto: [INFO] Init mbc-mosto... ") ;

        function startall() {
            self.server     = new mvcp_server(self.config.mvcp_server);
            self.driver     = new playlists_driver(self.config.playlist_server);
            self.status_driver = status_driver();

            self.fetcher        = new mosto_fetcher( { mosto: self } );
            self.scheduler      = new mosto_scheduler( { mosto: self } );
            self.synchronizer   = new mosto_synchronizer( { mosto: self } );
            self.player         = new mosto_player( { mosto: self } );

            self.player.on('playing', function(x) { self.emit('playing', x) });
            self.player.on('status', function(x) { self.emit('status', x) });

            self.initDriver();

            self.fetcher.init();
            self.scheduler.init();
            self.synchronizer.init();
            self.player.init();

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
