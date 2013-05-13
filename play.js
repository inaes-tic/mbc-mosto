var fs               = require('fs'),
    util             = require('util'),
    utils            = require('./utils'),
    events           = require('events'),
    moments           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia'),
    _                = require('underscore'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'),
    StreamerCom      = require('./api/StreamerCom');

function play( config ) {

    StreamerCom.call(this);

    this.name = "player";
    this.mosto = config.mosto;
    this.server = config.mosto.server;
    this.status_driver = config.mosto.status_driver; 

    this.synchronizer = undefined;
    this.fetcher = undefined;
    this.scheduler = undefined;

    /** PLAY MODULE */
    this.timer = null;
    this.timer_clock = moment();
    this.timer_relative_clock = null;
    this.timer_expected_clock = null;
    this.timer_difference = 0;

    this.sync_lock = false;
    this.sync_lock_start = 0;
    this.sync_lock_time = 0;
    this.sync_lock_diff = 0;

    this.actual_playing_clip = null;
    this.actual_playing_status = "";
    this.actual_playing_index = -1;
    this.previous_playing_index = -1;
    this.actual_playing_frame = -1;
    this.actual_playing_length = -1;
    this.actual_playing_fps = -1;
    this.actual_playing_progress = -1;
    this.actual_position_millis = 0;
    this.actual_expected_start = 0;
    this.previous_expected_start = 0;
    this.previous_position_millis = 0;
    this.ref_sched_index = 0;

    this.actual_status = null;

    this.full_status = undefined;
    this.prev_full_status = undefined;
}

play.prototype = new StreamerCom();

play.prototype.init = function() {

    var self = this;

    this.fetcher = this.mosto.fetcher;
    this.scheduler = this.mosto.scheduler;
    this.synchronizer = this.mosto.synchronizer;

    if (this.synchronizer)
        this.synchronizer.on('sync_downstream', function() {
            console.log("mbc-mosto: [INFO] [PLAY] received sync_downstream from [SYNC]");
        });


}


    }

    play.prototype.sendStatus = function() {
        //real invocations.  This is just an example
        self.server.getServerStatus(function(resp1) {
            var status = resp1;
            self.server.getServerPlaylist(function(resp2) {
                var playlist = resp2;
                var st = self.buildStatus(playlist, status);
                self.emit("status", st);
            });
        });
    };

    play.prototype.buildStatus = function(serverPlaylist, serverStatus) {
        var status = {};
        var clip = {};
        var show = {};

        var currentPlaylistId = undefined;
        var prevPlaylistId    = undefined;
        var nextPlaylistId    = undefined;
        var currentClip       = undefined;
        var prevClip          = undefined;
        var nextClip          = undefined;

        //console.log("mbc-mosto: [INFO] [PLAY] buildStatus: serverplaylist: " + serverPlaylist + " serverstatus:" + serverStatus + " playlists:"+self.fetcher.playlists );

        if (serverStatus.actualClip !== undefined) {
            currentPlaylistId = serverStatus.actualClip.playlistId;
            if (self.fetcher.playlists!==undefined && self.fetcher.playlists.length>0) {
                // map the playlists list to their ids (converted to string)
                //console.log("mbc-mosto: [INFO] [PLAY] buildStatus: mapping playlist to their ids" );
                var index = _.chain(self.fetcher.playlists).map(function(playlist) {
                    return playlist.id.toString() }).indexOf(
                        serverStatus.actualClip.playlistId.toString() ).value();

                if (index >= 0)
                    currentPlaylistId = self.fetcher.playlists[index].id;
                if (index > 0)
                    prevPlaylistId = self.fetcher.playlists[index - 1].id;
                if (0<=index && index < (self.fetcher.playlists.length - 1))
                    nextPlaylistId = self.fetcher.playlists[index + 1].id;
            }
        }

        currentClip = serverStatus.actualClip;
        if (serverPlaylist!==undefined && serverPlaylist.length>0 && currentClip!=undefined) {
            var currentClipOrder = parseInt(currentClip.order);
            if ( currentClipOrder > 0 ) {
                prevClip = _.find(serverPlaylist, function(walkClip) {
                    return (parseInt(walkClip.order) == (currentClipOrder - 1));
                });
            }
            if( currentClipOrder < (serverPlaylist.length - 1) ) {
                nextClip = _.find(serverPlaylist, function(walkClip) {
                    return (parseInt(walkClip.order) == (currentClipOrder + 1));
                });
            }
        }
        clip.previous = prevClip;
        clip.current  = currentClip;
        clip.next     = nextClip;

        show.previous = prevPlaylistId;
        show.current  = currentPlaylistId;
        show.next     = nextPlaylistId;

        status.clip     = clip;
        status.show     = show;
        status.position = serverStatus.currentPos;
        status.clips    = serverPlaylist;
        status.status   = serverStatus.status;

        return status;
    };

    play.prototype.statusHasChanged = function() {

        var result = ( self.prev_full_status == undefined );
        if (result) return result;
        result = result || ( self.prev_full_status && self.full_status
                && ( self.prev_full_status.clips.length!=self.full_status.clips.length
                     || self.prev_full_status.clip.current!=self.full_status.clip.current
                     || self.prev_full_status.clip.prev!=self.full_status.clip.prev
                     || self.prev_full_status.clip.next!=self.full_status.clip.next

                     || self.prev_full_status.show.prev!=self.full_status.show.prev
                     || self.prev_full_status.show.current!=self.full_status.show.current
                     || self.prev_full_status.show.next!=self.full_status.show.next
                    ) 
                );
        return result;
    }

    /** PLAY MODULE*/
    /**
     *       start timer: not necessarelly frame accurate, interval: 200 ms
     *
     */

    play.prototype.timer_fun_status = function( actual_status ) {

        console.log("mbc-mosto: [INFO] [PLAY] timer_fun_status received.");

        self.previous_playing_index = self.actual_playing_index;

        self.actual_status = actual_status;

        self.actual_playing_status = self.actual_status.status;

        if (    self.actual_playing_status=="playing" 
                || (self.actual_playing_status=="paused" && self.actual_status.actualClip.id=="black_id") ) {
            self.actual_playing_clip = self.actual_status.actualClip.id;
            self.actual_playing_index = parseInt(self.actual_status.actualClip.order);
            self.actual_playing_progress = self.actual_status.currentPos;
            self.actual_playing_frame = parseInt(self.actual_status.actualClip.currentFrame);
            self.actual_playing_length = parseInt(self.actual_status.actualClip.totalFrames);
            self.actual_playing_fps =  self.actual_status.actualClip.fps;

            self.emit('statusclip', self.actual_status.actualClip);

            self.actual_position_millis = utils.convertFramesToMilliseconds( self.actual_status.actualClip.currentFrame, self.actual_status.actualClip.fps );
            self.actual_position_millis_length = self.actual_status.actualClip.totalFrames;

            self.emit('playing','playing clip: ' + self.actual_playing_clip );
        } else {
            self.actual_playing_frame = -1;
            self.actual_playing_index = -1;
            self.actual_position_millis = -1;
            self.actual_playing_clip = -1;
            self.actual_playing_progress = -1;
        }


        console.log("mbc-mosto: [INFO] [PLAY] timer_fun_status status: " + self.actual_playing_status + " clip: " + self.actual_playing_clip );

        self.server.getServerPlaylist( function( server_playing_list ) { 

                console.log("mbc-mosto: [INFO] [PLAY] building status.");
                self.prev_full_status = self.full_status;
                self.full_status = self.buildStatus( server_playing_list, self.actual_status );

                console.log("mbc-mosto: [INFO] [PLAY] checking if status changed.");
                if ( self.statusHasChanged() ) {
                    //console.log("mbc-mosto: [INFO] [PLAY] status has changed so we emit full status : " + self.full_status);
                    self.emit('status', self.full_status );
                }

                //self.synchronizer.syncroScheduledClips( server_playing_list ); 
                console.log("mbc-mosto: [INFO] [PLAY] emitting sync_upstream");
                self.emit('sync_upstream', { 
                    server_playlist: server_playing_list, 
                    server_status: self.actual_status 
                } );
            
            }, 
            function(error) { 
                console.error("mbc-mosto: [ERROR] timer_fun_status >  getServerPlaylist() : " + error ); 
            } 
        );

    }

    play.prototype.timerLock = function() {
        self.sync_lock = true;
    }

    play.prototype.timerUnlock = function() {
        self.sync_lock = false;
    }

    play.prototype.timerLocked = function() {
        return self.sync_lock;
    }

    play.prototype.upstreamActive = function() {
        return self.sync_lock;
    }

    play.prototype.timer_fun = function() {

        if (!self.sync_lock) {

            self.timerLock();

            //calculate now time...
            self.timer_clock = moment();
            self.sync_lock_start = moment();

            console.log("mbc-mosto: [INFO] [PLAY] timer_fun called: " + self.timer_clock.format("hh:mm:ss") );
            console.log("mbc-mosto: [INFO] [PLAY] time_window from: "  + self.fetcher.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to: " + self.fetcher.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

            //get status
            self.server.getServerStatus( self.timer_fun_status, function( error ) { console.error("mbc-mosto: [ERROR] [PLAY] mosto.timer_fun > getServerStatus failed: " + error ); } );
        } else {
            self.sync_lock_time = moment();
            self.sync_lock_diff = self.sync_lock_time.diff(self.sync_lock_start);
            console.log("mbc-mosto: [INFO] sync LOCKED, for " + self.sync_lock_diff );
            if (Math.abs(self.sync_lock_diff)>2000) {
                //kill server and reconnect!!!
                self.mosto.server = null;
                self.mosto.server = new mvcp_server(self.mosto.config.mvcp_server);
                self.server = self.mosto.server;
                self.timerUnlock();
                self.stop();
                self.mosto.startMvcpServer(self.play);               
            }
        }
    }

    play.prototype.play = function() {

        console.log("mbc-mosto: [INFO] Start playing mosto");

        if (!self.timer) {

            if (self.fetcher) {
                self.fetcher.updateTimeWindow();
                console.log("mbc-mosto: [INFO] [PLAY] setting window: from: "  + self.fetcher.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to: " + self.fetcher.time_window_to.format("DD/MM/YYYY HH:mm:ss") );
            }

            self.timer = setInterval( self.timer_fun, self.mosto.config.timer_interval );
            self.timer_fun();

            self.on('statusclip', function(stclip) {
                console.log("mbc-mosto: [INFO] [PLAY] emitting statusclip: " + stclip.currentFrame + " / "+  stclip.totalFrames);
                if (self.status_driver) self.status_driver.setStatusClip(stclip);
            });

            self.on('status', function(st) {
                console.log("mbc-mosto: [INFO] [PLAY] emitting status");
                if (self.status_driver) self.status_driver.setStatus(st);
            });

        }
    }

    play.prototype.stop = function() {
	    clearInterval(self.timer);
        self.timer = null;
    }

    play.prototype.pause = function() {}



exports = module.exports = function(config) {
    var mosto_player = new play(config);
    mosto_player.ResetListeners();
    return mosto_player;
};
















