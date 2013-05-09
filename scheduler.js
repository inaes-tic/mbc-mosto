var fs               = require('fs'),
    util             = require('util'),
    utils            = require('./utils'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia');

function scheduler( config ) {

    var self = this;

    self.mosto = config.mosto;
    self.fetcher = undefined;
    self.player = undefined;

    self.scheduled_clips = []; //here we must have the current playlist up to date...
    self.scheduled_clips_updated = false;

    scheduler.prototype.init = function() {
        self.fetcher = self.mosto.fetcher;
        self.player = self.mosto.player;
    }

    scheduler.prototype.queueBlack = function( schedule_time, sch_duration, sch_expect_start, sch_expect_end ) {
        //Media(id, orig_order, actual_order, playlist_id, name, type, file, length, fps)
        var BlackMedia = new Media( 'black_id' /*id*/, '0' /*orig_order*/, '0'/*actual_order*/, '0' /*playlist_id*/, 'black' /*name*/, 'file' /*type*/, self.mosto.config.black, sch_duration/*length*/, ''/*fps*/ );
        console.log("mbc-mosto: [INFO] [LOGIC] queueBlack > media:" + BlackMedia.file + " schedule_time:" + schedule_time + " sch_duration:" + sch_duration + " sch_expect_start:" + sch_expect_start + " sch_expect_end:" + sch_expect_end + " fps?:"+BlackMedia.fps );
        self.scheduled_clips.push( new ScheduledMedia( BlackMedia, schedule_time, sch_duration, sch_expect_start, sch_expect_end ) );

    }

    /** LOGIC SCHEDULER MODULE */
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
    scheduler.prototype.convertPlaylistsToScheduledClips = function( propagate ) {

        console.log("mbc-mosto: [INFO] [LOGIC] converting Playlists to scheduled clips");

        self.emit('converting', '[LOGIC] Scheduler start' );

        //Check if we need to make a checkout! (upstream syncro!! > sync_lock must be true )
        //UPSTREAM
        if ( self.player && self.player.upstreamActive() ) {

            if (self.fetcher.playlists.length==0) {
                //make a checkout... (not necesarry if DB Driver take care of it??
                console.log("mbc-mosto: [INFO] [LOGIC] we have no playlists.");
                return  self.fetcher.checkoutPlaylists();
            }

            //if time_window advance for 1 hours (4 hours > 3 hours left ), we make a checkout...[FETCH]
            var rt_actual_window = self.fetcher.time_window_to.diff( moment() );
            var rt_min_window = moment.duration( { hours: 3 } ).asMilliseconds();

            console.log("mbc-mosto: [INFO] [LOGIC] converPlaylistsToScheduledClips() > rt_actual_window:" + rt_actual_window + " rt_min_window:" + rt_min_window );
            if (  rt_actual_window < rt_min_window ) {
                console.log("mbc-mosto: [INFO] [LOGIC] window advanced at least one hour... calling [FETCH] checkoutPlaylists actual:" + rt_actual_window + " min:" + rt_min_window);
                return  self.fetcher.checkoutPlaylists();//really updates time window too
            }
        }

        //clean scheduled clips
        if (self.fetcher.playlists_updated) {
            self.scheduled_clips = [];
            if (self.fetcher.playlists.length>0) {
                console.log("mbc-mosto: [INFO] [LOGIC] actually converting playlists ("+self.fetcher.playlists.length+").");
                self.preparePlaylist( 0, -1 );
            }
            self.fetcher.playlists_updated = false;
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
    scheduler.prototype.preparePlaylist = function( next_playlist_id, lastTimeCode ) {

        var pl = self.fetcher.playlists[next_playlist_id];
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
                                var tnow = moment();
                                if (self.player) tnow = self.player.timer_clock;
                                if (self.player && !self.player.timer_clock) tnow = self.player.timer_clock = moment();
                                var sch_time_mom = moment(sch_time, "DD/MM/YYYY HH:mm:ss.SSS");
                                var sch_rightnow = moment(tnow).format("DD/MM/YYYY HH:mm:ss.SSS");
                                var diff_void_start = sch_time_mom.diff( tnow );
                                black_duration = moment.duration( sch_time_mom - tnow );
                                black_duration_str = utils.convertDurationToString(black_duration);
                                var sch_to_next_playlist = moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(black_duration).format('DD/MM/YYYY HH:mm:ss.SSS');
                                console.log("mbc-mosto: [INFO] [LOGIC] preparePlaylist > empty space ? diff_void_start :" + diff_void_start );

                                if (diff_void_start>0) {
                                    self.queueBlack( sch_rightnow, black_duration_str, sch_rightnow, sch_to_next_playlist );
                                    sch_time = "now";
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
        if (self.fetcher.playlists.length==next_playlist_id) {
            if (next_playlist_id > 0 && lastTimeCode!=-1 && pl.id!="black_id") {
                var black_duration, black_duration_str;
                black_duration = moment.duration( self.fetcher.time_window_to - last_tc );
                black_duration_str = utils.convertDurationToString(black_duration);
                //queue blackness to the end of the last playlist (no after a black media!) till last frame window
                self.queueBlack( "now", black_duration_str, lastTimeCode, moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS").add(black_duration).format('DD/MM/YYYY HH:mm:ss.SSS') );
            }
            return;
        }

        return self.preparePlaylist( next_playlist_id, lastTimeCode );
    }

};

exports = module.exports = function(config) {
    util.inherits(scheduler, events.EventEmitter);
    var mosto_scheduler = new scheduler(config);
    return mosto_scheduler;
};


