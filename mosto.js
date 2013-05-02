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
    _                = require('underscore');
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
    var self = this;


    /** FETCH MODULE */

    //TODO: testing json, then mongodb

    /** addPlaylist
     *
     *       add a new playlist
     */
    mosto.prototype.addPlaylist = function(playlist) {

        console.log("mbc-mosto: [INFO] Adding playlist " + playlist.name);
        self.playlists.push(playlist);
        console.log("mbc-mosto: [INFO] Added playlist:\nid: " + playlist.id
                    + "\nname: " + playlist.name
                    + "\nstartDate: " + playlist.startDate
                    + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };

    /** updatePlaylist
     *
     *       update only if we are in range?! i dont want playlists scheduled for tomorrow nw!!!
     */
    mosto.prototype.updatePlaylist = function(playlist) {

        console.log("mbc-mosto: [INFO] Updating playlist " + playlist.name);
        var i = -1;
        self.playlists.some(function(element, index, array) {
            if (element.id === playlist.id) {
                i = index;
                return true;
            }
        });

        //update may create or delete if needed
        if (i==-1) {
            return self.addPlaylist(playlist);
        } else {
            if ( (moment(playlist.startDate) <= self.time_window_to &&
                  moment(playlist.endDate) >= self.time_window_from ) ) {
                self.playlists[i] = playlist;            
            } else return self.removePlaylist(playlist.id);
        }

        console.log("mbc-mosto: [INFO] Updated playlist:\nid: " + playlist.id
                    + "\nname: " + playlist.name
                    + "\nstartDate: " + playlist.startDate
                    + "\nendDate: " + playlist.endDate);

        self.orderPlaylists();
    };

    /** removePlaylist
     *
     *
     */
    mosto.prototype.removePlaylist = function(id) {

        console.log("mbc-mosto: [INFO] Removing playlist id: " + id);
        var i = -1;
        var playlist = undefined;
        if (self.playlists.length>0) {
            self.playlists.some(function(element, index, array) {
                if (element!==undefined) {
                    if (element.id === id) {
                        i = index;
                        playlist = element;
                        return true;
                    }
                }
            });
        }
        if (i!=-1) self.playlists.splice(i, 1);
        if (playlist!=undefined) {
            console.log("mbc-mosto: [INFO] Removed playlist:\nid: " + playlist.id
                        + "\nname: " + playlist.name
                        + "\nstartDate: " + playlist.startDate
                        + "\nendDate: " + playlist.endDate);
        }
        self.orderPlaylists();
    };

    /** orderPlaylists
     *       Sort playlists using startDate as key
     *
     *
     */
    mosto.prototype.orderPlaylists = function() {
    
        self.removeBlackPlaylist();        
        self.trimPlaylists();

        if (self.playlists.length==0) {
            var sch_rightnow = moment(self.timer_clock).add( moment.duration({ milliseconds: 0 }) ).format("DD/MM/YYYY HH:mm:ss.SSS");
            self.startBlack( sch_rightnow, "00:00:50.00", sch_rightnow, moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 50000 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
        }

        console.log("mbc-mosto: [INFO] Start ordering playlists " + self.playlists.length);
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Finish ordering playlists");
        self.playlists_updated = true;
        self.convertPlaylistsToScheduledClips();
    };

    
    /** trimPlaylists
     *       remove any playlist that is out of our time window
     *
     *
     */
    mosto.prototype.trimPlaylists = function() {
        self.updateTimeWindow();
        var newplaylists = [];
        for(var i=0; i<self.playlists.length;i++) {
            var playlist = self.playlists[i];
            if ( (moment(playlist.startDate) <= self.time_window_to &&
                  moment(playlist.endDate) >= self.time_window_from ) 
                && (playlist.id != 'black_id') ) {
                console.log("mbc-mosto: [INFO] [FETCH] trimming playlists:" + playlist.id );
                newplaylists.push(playlist);
            }
        }
        self.playlists = newplaylists;
    }

    mosto.prototype.removeBlackPlaylist = function() {
        var i = -1;
        var playlist = undefined;
        if (self.playlists.length>0) {
            self.playlists.some(function(element, index, array) {
                if (element!==undefined) {
                    if (element.id === 'black_id') {
                        i = index;
                        playlist = element;
                        return true;
                    }
                }
            });
        }
        if (i!=-1) self.playlists.splice(i, 1);        
    }

    mosto.prototype.updateTimeWindow = function() {
        self.timer_clock = moment();
        self.sync_lock_start = moment();

        self.time_window_from = moment( moment().toDate());
        //var last_time_window_to = self.time_window_to.clone();
        //var last_time_window_to = self.time_window_from.clone();
        self.time_window_to = self.time_window_from.clone();
        self.time_window_to.add( moment.duration({ hours: 4 }) );

        if (self.driver) self.driver.setWindow( self.time_window_from, self.time_window_to );

    }

    /**     checkoutPlaylists
     *       checkout load next playlists if needed
     *       each call to checkoutPlaylists advance the time_window
     *
     *       We are using a minimum memory overhead approach to store the playlists
     *       Full playlist has a maximum of 4 hours total length starting from "now"
     *       Any older playlist are removed from memory to release memory
     */
    mosto.prototype.checkoutPlaylists = function(callback) {
        console.log("mbc-mosto: [INFO] [FETCH] checking out new playlists in our time window.");

        //TODO: just ask for the difference between "actual time window" and "last time window"
        var last_time_window_to = moment(self.time_window_to);

        self.updateTimeWindow();

        console.log("mbc-mosto: [INFO] [FETCH] checkoutPlaylists > from: " + self.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to:" + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

        //now we read playlists, between "last_time_window_to" and "time_window_to"
        if (self.driver)
            self.driver.getPlaylists( { from: self.time_window_from, to: self.time_window_to, setWindow: false }, function(playlists) {

                //just import new ones....
                console.log("mbc-mosto: [INFO] [LOGIC] checkoutPlaylists > receive playlists from: " + last_time_window_to.format("DD/MM/YYYY HH:mm:ss") + " to:" + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );
                for( var p=0;p<playlists.length;p++) {
                    var playlist = playlists[p];
                    var i = -1;
                    self.playlists.some( function(element, index, array) {
                        if (element.id === playlist.id) {
                            i = index;
                            return true;
                        }
                    });
                    if (i==-1) {
                        self.playlists.push(playlist);
                    }
                }

                self.orderPlaylists();

                //update the boundaries
                self.driver.setWindow( self.time_window_from, self.time_window_to );
    
                if (callback) callback(playlists);
            } );

    }

    mosto.prototype.startBlack = function( schedule_time, sch_duration, sch_expect_start, sch_expect_end ) {
        var BlackMedia = new Media( 'black_id' /*id*/, '0' /*orig_order*/, '0'/*actual_order*/, 'black_id' /*playlist_id*/, 'black' /*name*/, 'file' /*type*/, self.config.black, sch_duration/*length*/, ''/*fps*/ );
        console.log("mbc-mosto: [INFO] [LOGIC] startBlack > media:" + BlackMedia.file + " schedule_time:" + schedule_time + " sch_duration:" + sch_duration + " sch_expect_start:" + sch_expect_start + " sch_expect_end:" + sch_expect_end + " fps?:"+BlackMedia.fps );
        var medias = [];
        medias.push(BlackMedia);
        self.playlists.push( new Playlist( BlackMedia.id, BlackMedia.id, moment( sch_expect_start, "DD/MM/YYYY HH:mm:ss.SSS" ).toDate(), medias, moment( sch_expect_end, "DD/MM/YYYY HH:mm:ss.SSS" ).toDate(), "snap" ) );
    }

    mosto.prototype.queueBlack = function( schedule_time, sch_duration, sch_expect_start, sch_expect_end ) {
        //Media(id, orig_order, actual_order, playlist_id, name, type, file, length, fps)
        var BlackMedia = new Media( 'black_id' /*id*/, '0' /*orig_order*/, '0'/*actual_order*/, '0' /*playlist_id*/, 'black' /*name*/, 'file' /*type*/, self.config.black, sch_duration/*length*/, ''/*fps*/ );
        console.log("mbc-mosto: [INFO] [LOGIC] queueBlack > media:" + BlackMedia.file + " schedule_time:" + schedule_time + " sch_duration:" + sch_duration + " sch_expect_start:" + sch_expect_start + " sch_expect_end:" + sch_expect_end + " fps?:"+BlackMedia.fps );
        self.scheduled_clips.push( new ScheduledMedia( BlackMedia, schedule_time, sch_duration, sch_expect_start, sch_expect_end ) );

    }

    /** LOGIC MODULE */
    //TODO: testing moment.js, converting time, test recursion

    /** convertPlaylistsToScheduledClips
     *
     * here we make all the necesarry calculations and update the current playlist
     * maybe create some warning messages
     * check coherence in scheduled playlists
     * add playlist_attribute= {} in Playlist.js
     *
     * case 0: no playlist available
     *       see modes: snap | fixed
     * case 1: next playlist is overlapped
     *       see modes: snap | fixed
     * case 2: next playlist start more than xx seconds after this one
     *       see modes: snap | fixed
     *
     *       We use a recursive function preparePlaylist
     */
    mosto.prototype.convertPlaylistsToScheduledClips = function( propagate ) {

        console.log("mbc-mosto: [INFO] [LOGIC] converting Playlists to scheduled clips");

        self.emit('converting', '[LOGIC] Scheduler start' );

        //Check if we need to make a checkout! (upstream syncro!! > sync_lock must be true )
        //UPSTREAM
        if ( self.upstreamActive() ) {

            if (self.playlists.length==0) {
                //make a checkout... (not necesarry if DB Driver take care of it??
                console.log("mbc-mosto: [INFO] [LOGIC] we have no playlists.");
                return  self.checkoutPlaylists();
            }

            //if time_window advance for 1 hours (4 hours > 3 hours left ), we make a checkout...[FETCH]
            var rt_actual_window = self.time_window_to.diff( moment() );
            var rt_min_window = moment.duration( { hours: 3 } ).asMilliseconds();

            console.log("mbc-mosto: [INFO] [LOGIC] converPlaylistsToScheduledClips() > rt_actual_window:" + rt_actual_window + " rt_min_window:" + rt_min_window );
            if (  rt_actual_window < rt_min_window ) {
                console.log("mbc-mosto: [INFO] [LOGIC] window advanced at least one hour... calling [FETCH] checkoutPlaylists actual:" + rt_actual_window + " min:" + rt_min_window);
                return  self.checkoutPlaylists();//really updates time window too
            }
        }

        //clean scheduled clips
        if (self.playlists_updated) {
            self.scheduled_clips = [];
            if (self.playlists.length>0) {
                console.log("mbc-mosto: [INFO] [LOGIC] actually converting playlists ("+self.playlists.length+").");
                self.preparePlaylist( 0, -1 );
            }
            self.playlists_updated = false;
        }

        self.emit('converted', '[LOGIC] Scheduler end' );

        //TODO: try to syncro immediatelly
        //or wait for timer synchronization
        //self.server.getServerPlaylist( self.syncroScheduledClips );
        
    }

    /** preparePlaylist
     *       recursive convert for convertPlaylistsToScheduledClips
     *
     *       @see convertPlaylistsToScheduledClips
     */
    mosto.prototype.preparePlaylist = function( next_playlist_id, lastTimeCode ) {

        var pl = self.playlists[next_playlist_id];
        var milis,sch_duration_m;
        var sch_duration, sch_time, sch_expect_start, sch_expect_end, schedule_time;
        var i = 0,is = 0;
        var pl_tc, last_tc, diff = 0;

        /*
          if (!self.validatePlaylist(pl)) {
          console.log("mbc-mosto: [ERROR] in preparePlaylist: " + pl.name );
          }
        */
        if (pl==undefined) return;

        pl_tc = moment( pl.startDate );

        if  ( lastTimeCode!=-1 ) {
            last_tc = moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS");
            diff = last_tc.diff( pl_tc );
        } else last_tc = pl_tc;

        console.log("mbc-mosto: [INFO] [LOGIC] preparePlaylist() : next_playlist_id : " + next_playlist_id + " startDate:" + pl_tc.format("DD/MM/YYYY HH:mm:ss") + " lastTimeCode:" +  lastTimeCode + " diff:" + diff );

        if ( lastTimeCode==-1
             || diff < 10000
           ) {

            if ( pl.mode == "snap") {
                // just add all clips with schedule: "now" if diff is less than 10 seconds, else push with own timecode (sch_time = sch_expect_start
                is = 0;
                sch_expect_end = moment( pl_tc, "DD/MM/YYYY HH:mm:ss").format("DD/MM/YYYY HH:mm:ss.SSS");
                for( i=0; i<pl.medias.length; i++) {
                    var sMedia = pl.medias[i];
                    milis = utils.convertFramesToMilliseconds( sMedia.length, sMedia.fps );
                    sch_duration_m = moment.duration( { milliseconds: milis } );

                    sch_time = moment( sch_expect_end, "DD/MM/YYYY HH:mm:ss.SSS").format("DD/MM/YYYY HH:mm:ss.SSS");
                    sch_duration = sch_duration_m.hours() + ":" + sch_duration_m.minutes() + ":" + sch_duration_m.seconds() + "." + sch_duration_m.milliseconds();
                    sch_expect_start = sch_time;
                    sch_expect_end = moment( sch_time ,"DD/MM/YYYY HH:mm:ss.SSS").add( sch_duration_m ).format("DD/MM/YYYY HH:mm:ss.SSS");

                    diff = last_tc.diff( moment( sch_time, "DD/MM/YYYY HH:mm:ss.SSS") );

                    //choose if queue or schedule...
                    if ( (i==0 && Math.abs(diff)<10000 && next_playlist_id>0 ) // first clip of queued playlists if diff <  10 seconds are queued
                         ||
                         ( i>0 && Math.abs(diff)<10000)  ) //clips >0 => all queued clips after first one
                        {
                            schedule_time = "now";
                        } else if (
                            (next_playlist_id==0 && i==0) // first playlist we have, it always need a schedule time
                                ||
                                (Math.abs(diff)>10000) ) // if diff > 10 seconds > use schedule time... (maybe a warning)
                        {
                            //check if we have unclosed playlists (without black end clip) before this new one...
                            var black_duration, black_duration_str;

                            if (next_playlist_id>0) {
                                black_duration = moment.duration({ milliseconds: Math.abs(diff) });
                                black_duration_str = utils.convertDurationToString(black_duration);
                                self.queueBlack( "now", black_duration_str, lastTimeCode, moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS").add(black_duration).format('DD/MM/YYYY HH:mm:ss.SSS') );
                            } else if (next_playlist_id==0) {
                                //if this is the first and only playlist, check if an empty void is left before it...., so we can put our blackmedia...
                                if (self.timer_clock==null) self.timer_clock = moment();
                                var sch_time_mom = moment(sch_time, "DD/MM/YYYY HH:mm:ss.SSS");
                                var sch_rightnow = moment(self.timer_clock).format("DD/MM/YYYY HH:mm:ss.SSS");
                                var diff_void_start = sch_time_mom.diff( self.timer_clock );
                                black_duration = moment.duration( sch_time_mom - self.timer_clock );
                                black_duration_str = utils.convertDurationToString(black_duration);
                                var sch_to_next_playlist = moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(black_duration).format('DD/MM/YYYY HH:mm:ss.SSS');
                                console.log("mbc-mosto: [INFO] [LOGIC] preparePlaylist > empty space ? diff_void_start :" + diff_void_start );

                                if (diff_void_start>0) {
                                    self.queueBlack( sch_rightnow, black_duration_str, sch_rightnow, sch_to_next_playlist );
                                }

                            }

                            schedule_time = sch_time;
                        }
                    console.log("mbc-mosto: [INFO] [LOGIC] adding scheduled clip: sched_time:" + schedule_time + " media.id:" + sMedia.id + " file:" + sMedia.file + " start:"+sch_expect_start+" end:"+sch_expect_end + " milis:" + milis );
                    self.scheduled_clips.push( new ScheduledMedia( sMedia, schedule_time, sch_duration, sch_expect_start, sch_expect_end ) );
                    lastTimeCode = sch_expect_end;
                    last_tc = moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS");
                }



            } else if ( pl.mode == "fixed") {
                //just add these clips replacing and cutting others!!
            }
        }

        next_playlist_id++;

        //iteration ended because we have no more playlists !
        if (self.playlists.length==next_playlist_id) {
            if (next_playlist_id > 0 && lastTimeCode!=-1 && pl.id!="black_id") {
                var black_duration, black_duration_str;
                black_duration = moment.duration( self.time_window_to - last_tc );
                black_duration_str = utils.convertDurationToString(black_duration);
                //queue blackness to the end of the last playlist (no after a black media!) till last frame window
                self.queueBlack( "now", black_duration_str, lastTimeCode, moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS").add(black_duration).format('DD/MM/YYYY HH:mm:ss.SSS') );
            }
            return;
        }

        return self.preparePlaylist( next_playlist_id, lastTimeCode );
    }

    mosto.prototype.sendStatus = function() {
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

    mosto.prototype.buildStatus = function(serverPlaylist, serverStatus) {
        var status = {};
        var clip = {};
        var show = {};

        var currentPlaylistId = undefined;
        var prevPlaylistId    = undefined;
        var nextPlaylistId    = undefined;
        var currentClip       = undefined;
        var prevClip          = undefined;
        var nextClip          = undefined;

        if (serverStatus.actualClip !== undefined) {
            currentPlaylistId = serverStatus.actualClip.playlistId;
            if (self.playlists!==undefined && self.playlists.length>0) {
                // map the playlists list to their ids (converted to string)
                var index = _.chain(self.playlists).map(function(playlist) {
                    return playlist.id.toString() }).indexOf(
                        serverStatus.actualClip.playlistId.toString() ).value();

                if (index >= 0)
                    currentPlaylistId = self.playlists[index].id;
                if (index > 0)
                    prevPlaylistId = self.playlists[index - 1].id;
                if (0<=index && index < (self.playlists.length - 1))
                    nextPlaylistId = self.playlists[index + 1].id;
            }
        }

        currentClip = serverStatus.actualClip;
        if (serverPlaylist!==undefined && serverPlaylist.length>0) {
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

    mosto.prototype.validatePlaylist = function( playlist ) {
        for( var i=0; i<playlist.length; i++) {
            element = playlist[i];
            if ( element.fps != self.config.fps ) {
                console.error("Playlist is not valid! media: " + element.file + " fps:" + element.fps );
                return false;
            }
        };
        return true;
    };

    mosto.prototype.convertMediaFileToClipId = function( media ) {
        return media.id;
    };

    /** playPlaylists
     *
     */
    mosto.prototype.playPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start playing playlists", self.playlists);
        self.playlists.forEach(function(element, index, array) {
            console.log("mbc-mosto: [INFO] looking at playlist", element);
            if (!element.loaded) {
                self.server.playPlaylist(element, function() {
                    self.server.getServerPlaylist(function(data) {
                        element.loaded = true;
                        console.log("Playlist loaded: ") ;
                        console.log(data);
                        self.server.getServerStatus(function(data) {
                            console.log("Currently playing: ") ;
                            console.log(data);
                        });
                    });
                });
            }
        });
    };

    mosto.prototype.statusHasChanged = function() {

        var result = ( self.prev_full_status == undefined );
        result = result || ( self.prev_full_status 
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
    
    /** SYNC MODULE */
    /**     syncroScheduledClips
     *
     *       compare every media scheduled in current_playlist with server  playlist
     *
     */
    mosto.prototype.syncroScheduledClips = function( server_playing_list ) {

        console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list medias = " + server_playing_list.length + " playingidx: " + self.actual_playing_index );

        self.emit('syncing', 'calling syncro upstream' );

        self.prev_full_status = self.full_status;
        self.full_status = self.buildStatus( server_playing_list, self.actual_status );
        if ( self.statusHasChanged() ) {
            self.emit('status', self.full_status );
        }

        //CALLING upstream when clips are needed...
        if ( self.ineedMoreClips( server_playing_list, 1 ) ) {
            console.log("mbc-mosto: [INFO] [SYNC MODULE] i'm hungry, i need more clips!!! calling upstream LOGIC > convertPlaylistsToScheduledClips()");
            self.convertPlaylistsToScheduledClips();
        }

        //SYNC METHOD: always check:
        // 1) if video server is playing the expected clip
        // 2) if queue clips are correct

        var expected_clip = self.getExpectedClip( server_playing_list );

        // DO WE HAVE AN EXPECTED CLIP ?
        if ( expected_clip ) {

            console.log("mbc-mosto: [INFO] expected clip: " + expected_clip.media.file + " from:" + expected_clip.expected_start + " to:" + expected_clip.expected_end );

            // IS IT PLAYING IN SERVER ?
            if ( self.isPlayingExpectedClip( expected_clip ) ) {

                console.log("mbc-mosto: [INFO] [SYNC] We are playing the expected clip !! ");

                var breakpoint_playing_cursor = -1;
                var breakpoint_scheduled_cursor = -1;
                var need_sync_clips = false;
                var i = 0, j = 0;
                //LETS CHECK THE OTHERS....
                //TODO: check maybe if we have enough time int this clip to check the full list...
                //console.log(" check  the others !! ");

                self.scheduled_clips_index_last_to_queue = 0;

                //PARSE scheduled clips, calculate actual clips to be queued
                /*IS
                  for( j=self.cursor_scheduled_clip+1; j<self.scheduled_clips.length; j++ ) {
                  var scheduled_c = self.scheduled_clips[j];
                  if (scheduled_c.schedule_time!="now") {
                  self.scheduled_clips_index_last_to_queue = j-1;
                  console.log("mbc-mnostp: [INFO] [SYNC] clips to be queued: " + self.scheduled_clips_index_last_to_queue );
                  }
                  }*/
                
                if (self.actual_playing_status=="playing") {
                    
                    for( i=self.actual_playing_index,j=self.cursor_scheduled_clip; i<server_playing_list.length && j<self.scheduled_clips.length; i++,j++) {
                        //COMPARE EACH ONE
                        //media on video server
                        var queued_media = server_playing_list[i];
                        //media expected in mosto
                        var scheduled_media = self.scheduled_clips[j].media;

                        breakpoint_playing_cursor = i;
                        breakpoint_scheduled_cursor = j;

                        //CHECK IF WE REACH AN INCOHERENCE
                        if ( queued_media.id !== scheduled_media.id ) {
                            //record he cursors
                            console.log("mbc-mosto: [INFO] [SYNC] CHECK OTHERS: diff founded, break, remove and append" );
                            need_sync_clips = true;
                            break;
                        }
                    }


                    // Force sync if there are more scheduled clips to queue....
                    /*
                      if ( (server_playing_list.medias.length-breakpoint_playing_cursor) < ( scheduled_clips_index_last_to_queue - breakpoint_scheduled_cursor) ) {
                      need_sync_clips = true;
                      }
                    */

                    // REMOVE PLAYING CLIPS: WIPE AFTER BREAKING CURSOR....
                    // AND ADD MISSING SCHEDULED CLIPS
                    if (need_sync_clips) {
                        console.log("mbc-mosto: [INFO] [SYNC] self.removePlayingClips after index: " + breakpoint_playing_cursor );
                        self.removePlayingClips(  breakpoint_playing_cursor, server_playing_list.length-1,
                                                  function() {
                                                      console.log("mbc-mosto: [INFO] [SYNC] self.removePlayingClips ok, now appendScheduledClips from index:  " + breakpoint_playing_cursor );
                                                      self.appendScheduledClips( breakpoint_scheduled_cursor );
                                                  },
                                                  function(error) {
                                                      console.error("mbc-mosto: [ERROR] [SYNC] removePlayingClips > error:"+error );
                                                      self.timerUnlock();
                                                  }
                                               );
                    } else self.timerUnlock();
                }
                self.timerUnlock();

            } else {
                //WE ARE NOT PLAYING THE EXPECTED ONE SO WE CLEAN UP AND LOAD/GOTO EXPECTED ONE
                self.server.cleanPlaylist( function(response) {
                    console.log("mbc-mosto: [INFO] cleanPlaylist ok! " + response );
                    var sched_clip = self.scheduled_clips[self.cursor_scheduled_clip];
                    self.server.appendClip( sched_clip.media, function(response) {
                        var next_index = 0;
                        if (self.actual_playing_index>-1) {
                            next_index = self.actual_playing_index+1;
                        }
                        self.server.goto( next_index, expected_clip.expected_frame, function(response) {                            
                            self.server.play(  function(response) {
                                console.log("mbc-mosto: [INFO] [SYNC] LOADED start playing!");
                                self.actual_expected_start = sched_clip.expected_start;
                                self.actual_playing_index = next_index;
                                self.previous_playing_index = next_index;
                                self.ref_sched_index = self.cursor_scheduled_clip;
                                self.previous_cursor_scheduled_clip = -1;
                                setTimeout( self.appendScheduledClips( self.cursor_scheduled_clip+1 ), 800);
                            },
                                           function(error) {
                                               console.error("mbc-mosto: [ERROR] error goto :"+error);
                                               self.timerUnlock();
                                           } );

                        },
                                           function(error) {
                                               console.error("mbc-mosto: [ERROR] error start playing:"+error);
                                               self.timerUnlock();
                                           } );

                    },
                                          function(error) {
                                              console.error("mbc-mosto: [ERROR] error loading clip:"+error);
                                              self.timerUnlock();
                                          } );
                },
                                           function(error) {
                                               console.error("mbc-mosto: [ERROR] error cleaning playlist:"+error);
                                               self.timerUnlock();
                                           } );



            }
        } else {
            //IF THERE IS NO EXPECTED CLIP > WE MUST HAVE OUR BLANK MOVIE PLAYING
            console.log("mbc-mosto: [INFO] [WARNING] no expected clip right now! (CHECK IF BLACK IS PLAYING OR PAUSED)");
            if ( self.actual_playing_clip == 'black_id'  ) {
                console.log("mbc-mosto: [INFO] FILLED WITH BLACK OK...");
            } else {
                console.log("mbc-mosto: [INFO] [WARNING] NOT BLACK!!! calling upstream scheduler... to fix it ASAP.");
                self.convertPlaylistsToScheduledClips();
            }
            self.timerUnlock();
        }

        self.emit('synced', 'finished ' );

    }

    mosto.prototype.ineedMoreClips = function( server_playing_list, min_queue_clips ) {
        // conditions are:
        // 1) video server is stopped
        // 2) video server list is empty
        // 3) video server list is not empty but number of queued clips remaining is less than min_queue_clips
        // 4) there are no scheduled_clips!!! we need some!!!

        return (    !server_playing_list 
                    ||
                    server_playing_list.length==0
                    ||
                    self.actual_playing_status=="stopped"
                    ||
                    self.scheduled_clips.length===0
                    ||
                    (   /*hay algo cargado pero... hay menos de min_queue_clips encolados luego del actual...*/
                        server_playing_list.length>0
                        &&
                        ( (server_playing_list.length-1) - self.actual_playing_index  ) < min_queue_clips )
                    );

    }

    mosto.prototype.getExpectedClip = function( server_playing_list ) {

        var expected_clip = null;
        var next_expected_clip = null;
        var next_expected_start = null;
        var expected_frame = 0;
        var reference_clock = null;

        self.previous_cursor_scheduled_clip = self.cursor_scheduled_clip;
        self.cursor_scheduled_clip = -1;

        /** CALCUTALE NEW RELATIVE CLOCK (based on video server index and expected clip start time */
        //playlist has avanced
        if ( self.previous_playing_index < self.actual_playing_index && self.actual_playing_status == "playing" ) {
            self.ref_sched_index = self.ref_sched_index + 1;
            self.actual_expected_start = self.scheduled_clips[ self.ref_sched_index ].expected_start;
            console.log("changed index from: " + self.previous_playing_index + " to " + self.actual_playing_index + " self.ref_sched_index:  "  + self.ref_sched_index  );
        }

        if (self.actual_playing_frame>=0 && self.actual_expected_start) {
            //calculate timer_relative_clock > warning, always do the expected_start of the playing clip...
            self.timer_relative_clock = moment( self.actual_expected_start, "DD/MM/YYYY HH:mm:ss.SSS" ).add(self.actual_position_millis);
            self.timer_difference = moment.duration( self.timer_relative_clock - self.timer_clock ).asMilliseconds();
            console.log("mbc-mosto: [INFO] [SYNC] timer_clock         " + " at:" + self.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] [SYNC] timer_relative_clock" + " at:" + self.timer_relative_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] [SYNC] progress: " + self.actual_playing_progress );
            console.log("mbc-mosto: [INFO] [SYNC] difference: " + self.timer_difference );
        } else self.timer_difference = 0; //back to absolute clocking (we are stopped)


        console.log( "Selecting reference clock :" + self.timer_difference );
        //if diff minimal, use absolute, if diff too big using absolute > to force re-load and re-sync!
        if( Math.abs(self.timer_difference) < 20 || Math.abs(self.timer_difference) > 10000 ) {
            console.log("using absolute clock > forcing");
            reference_clock = self.timer_clock;
        } else {
            console.log("using relative clock");
            reference_clock = self.timer_relative_clock;
        }

        console.log("mbc-mosto: [INFO] reference_clock         " + " at:" + reference_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );

        //NOW CHECK FOR SCHEDULED CLIP EXPECTED TO RUN NOW ( based on selected reference clock, always relative, but absolute must be needed to ensure reync)
        for( var i=0; i<self.scheduled_clips.length; i++) {
            var sched_clip = self.scheduled_clips[i];
            if (sched_clip) {
                var ex_start = moment(sched_clip.expected_start,"DD/MM/YYYY HH:mm:ss.SSS");
                var ex_end = moment(sched_clip.expected_end,"DD/MM/YYYY HH:mm:ss.SSS");
                if ( reference_clock < ex_start ) {
                    if (next_expected_start==null) {
                        next_expected_start = ex_start;
                    }
                    if ( ex_start <= next_expected_start ) {
                        next_expected_clip = sched_clip;
                        next_expected_start = ex_start;
                    }
                }

                if ( ex_start < reference_clock
                     && reference_clock < ex_end 
                    && expected_clip==null) {
                    self.cursor_scheduled_clip = i;
                    expected_clip = sched_clip;
                    // TODO: calculate frame position! based on length.
                    expected_frame = utils.getFramePositionFromClock( reference_clock, ex_start, 0, 25.00 );
                    if ( expected_frame == undefined) expected_frame = 0;
                    expected_clip.expected_frame = expected_frame;
                    self.actual_expected_start = expected_clip.expected_start;
                }
            }
        }

        if (next_expected_clip)
            console.log("mbc-mosto: [INFO] next_expected clip: " + next_expected_clip.media.file + " from:" + next_expected_clip.expected_start + " to:" + next_expected_clip.expected_end );

        return expected_clip;
    }

    mosto.prototype.isPlayingExpectedClip = function( expected_clip ) {
        //CHECK AND COMPARE IF WE ARE PLAYING THE EXPECTED ONE...
        console.log("COMPARE!!!" + self.actual_playing_status + " self.actual_playing_clip:"+self.actual_playing_clip + " vs expected: " + expected_clip.media.id );

        return (    self.actual_playing_clip != "" 
                    && (self.actual_playing_status == "playing" || self.actual_playing_status == "paused") 
                    && self.actual_playing_clip == expected_clip.media.id );
    }



    mosto.prototype.removePlayingClips = function( index_from, index_to, successCallback, errorCallback ) {

        if ( index_from > index_to ) {
            return successCallback();
        }

        self.server.removeClip( index_from, function(response) {
                index_from++;
                self.removePlayingClips( index_from, index_to, successCallback, errorCallback);
            },
            function(error) {
                errorCallback(error);
            }
        );

    }

    mosto.prototype.appendScheduledClips = function( index_iteration ) {

        console.log("APPENDING index_iteration: " + index_iteration + " over " + self.scheduled_clips.length + " elements" );
        if ( 0>index_iteration || index_iteration > (self.scheduled_clips.length-1) ) {
            console.log("mbc-mosto: [INFO]appendScheduledClips() > APPENDING : out of bound > stop appending");
            self.timerUnlock();
            return;
        }

        var sched_clip = self.scheduled_clips[index_iteration];

        if ( index_iteration>0 && sched_clip.schedule_time!="now") {
            //we break the loading loop at second appearance of a non-queued media...
            //so we must wait to the timer to call it automatically
            //WARNING!!! snap was done in convertPlaylists -> preparePlaylist
            console.log("mbc-mosto: [INFO] APPENDING : stop appending, schedule_time is not now: " + sched_clip.schedule_time);
            self.timerUnlock();
            return;
        } else index_iteration++;

        self.server.appendClip( sched_clip.media, function(response) {
                console.log("mbc-mosto: [INFO] appendScheduledClips() Iteration:" + index_iteration + " Append ok media " + sched_clip.media.file + " resp:" + response);
                self.appendScheduledClips( index_iteration );
            },
            function(error) {
                console.error("mbc-mosto: [ERROR] appendScheduledClips() Error appending clip:"+error);
                self.timerUnlock();
            }
          );

    }

    /** PLAY MODULE*/
    /**
     *       start timer: not necessarelly frame accurate, interval: 200 ms
     *
     */

    mosto.prototype.timer_fun_status = function( actual_status ) {

        console.log("mbc-mosto: [INFO] [PLAY] timer_fun_status received.");

        self.previous_playing_index = self.actual_playing_index;

        self.actual_status = actual_status;

        self.actual_playing_status = self.actual_status.status;

        if (    self.actual_playing_status=="playing" 
                || (self.actual_playing_status=="paused" && self.actual_status.actualClip.id=="black_id") ) {
            self.actual_playing_clip = self.actual_status.actualClip.id;
            self.actual_playing_index = self.actual_status.actualClip.order;
            self.actual_playing_progress = self.actual_status.currentPos;
            self.actual_playing_frame = self.actual_status.actualClip.currentFrame;
            self.actual_playing_length = self.actual_status.actualClip.totalFrames;
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


        console.log("mbc-mosto: [INFO] timer_fun_status status: " + self.actual_playing_status + " clip: " + self.actual_playing_clip );

        self.server.getServerPlaylist( self.syncroScheduledClips, function() { console.log("mbc-mosto: [ERROR] timer_fun_status >  getServerPlaylist() " ); } );

    }

    mosto.prototype.timerLock = function() {
        self.sync_lock = true;
    }

    mosto.prototype.timerUnlock = function() {
        self.sync_lock = false;
    }

    mosto.prototype.timerLocked = function() {
        return self.sync_lock;
    }

    mosto.prototype.upstreamActive = function() {
        return self.sync_lock;
    }

    mosto.prototype.timer_fun = function() {

        if (!self.sync_lock) {

            self.timerLock();

            //calculate now time...
            self.timer_clock = moment();
            self.sync_lock_start = moment();

            console.log("mbc-mosto: [INFO] [PLAY] timer_fun called: " + self.timer_clock.format("hh:mm:ss") );
            console.log("mbc-mosto: [INFO] [PLAY] time_window from: "  + self.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to: " + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

            //get status
            self.server.getServerStatus( self.timer_fun_status, function( error ) { console.log("mbc-mosto: [ERROR] mosto.timer_fun > getServerStatus failed: " + error ); } );
        } else {
            self.sync_lock_time = moment();
            self.sync_lock_diff = self.sync_lock_time.diff(self.sync_lock_start);
            console.log("mbc-mosto: [INFO] sync LOCKED, for " + self.sync_lock_diff );
            if (Math.abs(self.sync_lock_diff)>2000) {
                //kill server and reconnect!!!
                self.server = null;
                self.server = new mvcp_server(self.config.mvcp_server);
                self.timerUnlock();
                self.stop();
                self.startMvcpServer(self.play);               
            }
        }
    }

    mosto.prototype.play = function() {
        console.log("mbc-mosto: [INFO] Start playing mosto");
        if (!self.timer) {
            self.timer = setInterval( self.timer_fun, self.config.timer_interval );
            self.updateTimeWindow();
            self.timer_fun();
            console.log("mbc-mosto: [PLAY] setting window: from: "  + self.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to: " + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

            self.on('statusclip', function(stclip) {
                console.log("mbc-mosto: [PLAY] emitting statusclip: " + stclip.currentFrame + " / "+  stclip.totalFrames);
                if (self.status_driver) self.status_driver.setStatusClip(stclip);
            });

            self.on('status', function(st) {
                console.log("mbc-mosto: [PLAY] emitting status");
                if (self.status_driver) self.status_driver.setStatus(st);
            });

        }
    }

    mosto.prototype.stop = function() {
	    clearInterval(self.timer);
        self.timer = null;
    }

    mosto.prototype.pause = function() {
    }

    mosto.prototype.initDriver = function() {

        console.log("mbc-mosto: [INFO] Initializing playlists driver");

        self.driver.on ("create", self.addPlaylist);
        self.driver.on ("update", self.updatePlaylist);
        self.driver.on ("delete", self.removePlaylist);

        self.driver.start();
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
            var e = new Error("mbc-mosto: [ERROR] Error starting MVCP server: " + err + ".\nRetrying in 5 seconds...");
            console.error(e);
            setTimeout(function() {
                self.startMvcpServer(callback);
            }, 5000);
        });
    };

    /** CONFIGURATION */
    this.config     = false;
    this.server_started = false;

    /**     FETCH MODULE*/
    this.playlists  = []; // this is the scheduled playlists....in a range between now and max_playlist_duration
    this.time_window_from = "";
    this.time_window_to = "";
    this.playlists_updated = false;

    /** LOGIC MODULE*/
    this.scheduled_clips = []; //here we must have the current playlist up to date...
    this.scheduled_clips_updated = false;

    /** SYNC MODULE */
    this.actual_server_playlist = [];
    this.cursor_playing_clip = -1;
    this.cursor_next_clip = -1;
    this.sync_lock = false;
    this.scheduled_clips_index_last_to_queue = -1;
    this.cursor_scheduled_clip = -1;
    this.previous_cursor_scheduled_clip = -1;


    /** PLAY MODULE */
    this.timer = null;
    this.timer_clock = moment();
    this.timer_relative_clock = null;
    this.timer_expected_clock = null;
    this.timer_difference = 0;

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

    /** ALL MODULES */

    this.config = customConfig || config;
    this.server = undefined;
    this.driver = undefined;
    this.status_driver = undefined;

    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;

    mosto.prototype.init = function() {
        self.server     = new mvcp_server(self.config.mvcp_server);
        self.driver     = new playlists_driver(self.config.playlist_server);
        self.status_driver = status_driver();
        
        self.initDriver();
        self.startMvcpServer(self.play);
/*
        Melted.take(function() {
            Melted.stop(function(pid) {
                Melted.start(function(pid) {
                    Melted.setup( undefined, undefined, function(has_err) {
                        self.startMvcpServer(self.play);
                    });                    
                    Melted.leave();
                });
            });    
        });
*/        
    }    

}

exports = module.exports = function(customConfig) {
    util.inherits(mosto, events.EventEmitter);
    var mosto_server = new mosto(customConfig);
    return mosto_server;
};
