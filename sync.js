var fs               = require('fs'),
    util             = require('util'),
    utils            = require('./utils'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia');

function sync( config ) {

    var self = this;

    self.mosto = config.mosto;
    self.server = config.mosto.server;
    self.scheduler = undefined;
    self.player = undefined;

    /** SYNC MODULE */
    self.actual_server_playlist = [];
    self.cursor_playing_clip = -1;
    self.cursor_next_clip = -1;
  
    self.scheduled_clips_index_last_to_queue = -1;
    self.cursor_scheduled_clip = -1;
    self.previous_cursor_scheduled_clip = -1;

    self.sync_clips = [];

    sync.prototype.init = function() {
        self.scheduler = self.mosto.scheduler;
        self.scheduler.on( 'sync_downstream', function( scheduled_clips ) { 
                console.log("mbc-mosto: [INFO] [SYNC] receiving sync_downstream"); 
                self.server.getServerPlaylist( function( server_playlist ) {
                        self.syncroScheduledClips( scheduled_clips, server_playlist );
                    },
                    function(error) {
                        console.error("mbc-mosto: [ERROR] [SYNC] receiving sync_downstream event: on self.server.getServerPlaylist(...) " + error);
                    });
            }
        );

        self.player = self.mosto.player;
        self.player.on( 'sync_upstream', function(play_status) {
            console.log("mbc-mosto: [INFO] [SYNC] receiving sync_upstream"); 
            self.upstreamCheck( play_status ); 
        } );        

    }

    sync.prototype.timerUnlock = function( mess ) {
        console.log("mbc-mosto: [INFO] [SYNC] Unlocking from " + mess);
        self.player.timerUnlock();
    }

    sync.prototype.timerLock = function(mess) {
        console.log("mbc-mosto: [INFO] [SYNC] Locking from " + mess);
        self.player.timerLock();
    }

    sync.prototype.timerLocked = function() {
        return self.player.timerLocked();
    }


    sync.prototype.validatePlaylist = function( playlist ) {
        for( var i=0; i<playlist.length; i++) {
            element = playlist[i];
            if ( element.fps != self.config.fps ) {
                console.error("Playlist is not valid! media: " + element.file + " fps:" + element.fps );
                return false;
            }
        };
        return true;
    };

    sync.prototype.convertMediaFileToClipId = function( media ) {
        return media.id;
    };


    sync.prototype.upstreamCheck = function( play_status ) {

        

        //CALLING upstream when clips are needed...
        if ( self.ineedMoreClips( play_status.server_playlist, play_status.server_status, self.sync_clips, 1 ) ) {
            console.log("mbc-mosto: [INFO] [SYNC] i'm hungry, i need more clips!!! calling sched_upstream");
            self.emit('sched_upstream');//no message needed...
        } else self.timerUnlock(" upstreamCheck > no upstream needed.");

        
    };

    
    /** SYNC MODULE */
    /**     syncroScheduledClips
     *
     *       compare every media scheduled in current_playlist with server  playlist
     *
     */
    sync.prototype.syncroScheduledClips = function( scheduled_clips, server_playing_list ) {

        console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list medias = " + server_playing_list.length + " playingidx: " + self.player.actual_playing_index );

        self.emit('syncing', server_playing_list );

        self.actual_server_playlist = server_playing_list;
        self.sync_clips = scheduled_clips;

        //SYNC METHOD: always check:
        // 1) if video server is playing the expected clip
        // 2) if queue clips are correct
        var expected_clip = self.getExpectedClip( scheduled_clips );

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
                /*IS*/
                for( j=self.cursor_scheduled_clip+1; j<scheduled_clips.length; j++ ) {
                    var sclip = scheduled_clips[j];
                    if (sclip.schedule_time!="now") {
                        self.scheduled_clips_index_last_to_queue = j-1;
                        console.log("mbc-mosto: [INFO] [SYNC] clips to be queued: " + self.scheduled_clips_index_last_to_queue );
                    }
                }
                
                if (self.player.actual_playing_status=="playing") {
                    
                    for( i=self.player.actual_playing_index,j=self.cursor_scheduled_clip; i<server_playing_list.length && j<scheduled_clips.length; i++,j++) {
                        //COMPARE EACH ONE
                        //media on video server
                        var queued_media = server_playing_list[i];
                        //media expected in mosto
                        var scheduled_media = scheduled_clips[j].media;

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
                    var sched_clip = scheduled_clips[self.cursor_scheduled_clip];
                    self.server.appendClip( sched_clip.media, function(response) {
                        var next_index = 0;
                        if (self.player.actual_playing_index>-1) {
                            next_index = self.player.actual_playing_index+1;
                        }
                        self.server.goto( next_index, expected_clip.expected_frame, function(response) {                            
                            self.server.play(  function(response) {
                                console.log("mbc-mosto: [INFO] [SYNC] LOADED start playing!");
                                self.actual_expected_start = sched_clip.expected_start;
                                self.player.actual_playing_index = next_index;
                                self.player.previous_playing_index = next_index;
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
            if ( self.player.actual_playing_clip == 'black_id'  ) {
                console.log("mbc-mosto: [INFO] FILLED WITH BLACK OK...");
            } else {
                console.log("mbc-mosto: [INFO] [WARNING] NOT BLACK!!! calling upstream scheduler... to fix it ASAP.");
                self.emit( 'sched_upstream' );
                //self.scheduler.convertPlaylistsToScheduledClips();
            }
            self.timerUnlock();
            
        }

        self.emit('synced', 'finished ' );
        self.emit('play_downstream');

    }

    sync.prototype.ineedMoreClips = function( server_playing_list, server_status, scheduled_clips, min_queue_clips ) {
        // conditions are:
        // 1) video server is stopped
        // 2) video server list is empty
        // 3) video server list is not empty but number of queued clips remaining is less than min_queue_clips
        // 4) there are no scheduled_clips!!! we need some!!!

        return (    !server_playing_list 
                    ||
                    server_playing_list.length==0
                    ||
                    server_status.status=="stopped"
                    ||
                    scheduled_clips.length===0
                    ||
                    (   /*hay algo cargado pero... hay menos de min_queue_clips encolados luego del actual...*/
                        server_playing_list.length>0
                        &&
                        ( (server_playing_list.length-1) - server_status.actualClip.order  ) < min_queue_clips )
                    );

    }

    sync.prototype.getExpectedClip = function( scheduled_clips ) {

        console.log("mbc-mosto: [INFO] [SYNC] getExpectedClip");

        var expected_clip = null;
        var next_expected_clip = null;
        var next_expected_start = null;
        var expected_frame = 0;
        var reference_clock = null;

        self.previous_cursor_scheduled_clip = self.cursor_scheduled_clip;
        self.cursor_scheduled_clip = -1;

        /** CALCUTALE NEW RELATIVE CLOCK (based on video server index and expected clip start time */
        //playlist has avanced
        if ( self.player.previous_playing_index < self.player.actual_playing_index && self.player.actual_playing_status == "playing" ) {
            self.ref_sched_index = self.ref_sched_index + 1;
            var exp_clip = scheduled_clips[ self.ref_sched_index ];
            if (exp_clip) {
                self.player.actual_expected_start = exp_clip.expected_start;
                console.log("mbc-mosto: [INFO] [SYNC] changed index from: " + self.player.previous_playing_index + " to " + self.player.actual_playing_index + " self.ref_sched_index:  "  + self.ref_sched_index  );
            } else console.error("mbc-mosto: [ERROR] [SYNC] getExpectedClip > ref_sched_index out of bound.");
        }

        if (self.player.actual_playing_frame>=0 && self.player.actual_expected_start && self.player.actual_position_millis_length>1) {
            //calculate timer_relative_clock > warning, always do the expected_start of the playing clip...
            self.player.timer_relative_clock = moment( self.player.actual_expected_start, "DD/MM/YYYY HH:mm:ss.SSS" ).add(self.player.actual_position_millis);
            self.player.timer_difference = moment.duration( self.player.timer_relative_clock - self.player.timer_clock ).asMilliseconds();
            console.log("mbc-mosto: [INFO] [SYNC] timer_clock         " + " at:" + self.player.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] [SYNC] timer_relative_clock" + " at:" + self.player.timer_relative_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] [SYNC] progress: " + self.player.actual_playing_progress );
            console.log("mbc-mosto: [INFO] [SYNC] difference: " + self.player.timer_difference );
        } else self.player.timer_difference = 0; //back to absolute clocking (we are stopped)


        console.log( "Selecting reference clock :" + self.player.timer_difference );
       
        //if diff minimal, use absolute, if diff too big using absolute > to force re-load and re-sync!
        if( Math.abs(self.player.timer_difference) < 20 || Math.abs(self.player.timer_difference) > 10000 ) {
            console.log("using absolute clock > forcing");
            reference_clock = self.player.timer_clock;
        } else {
            console.log("using relative clock");
            reference_clock = self.player.timer_relative_clock;
        }
        //reference_clock = self.timer_clock;


        console.log("mbc-mosto: [INFO] reference_clock         " + " at:" + reference_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );

        //NOW CHECK FOR SCHEDULED CLIP EXPECTED TO RUN NOW ( based on selected reference clock, always relative, but absolute must be needed to ensure reync)
        for( var i=0; i<scheduled_clips.length; i++) {
            var sched_clip = scheduled_clips[i];
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

                if ( ex_start <= reference_clock
                     && reference_clock <= ex_end 
                    && expected_clip==null) {
                    self.cursor_scheduled_clip = i;
                    expected_clip = sched_clip;
                    // TODO: calculate frame position! based on length.
                    expected_frame = utils.getFramePositionFromClock( reference_clock, ex_start, 0, 25.00 );
                    if ( expected_frame == undefined || expected_clip.media.id=="black_id") expected_frame = 0;
                    expected_clip.expected_frame = expected_frame;
                    self.player.actual_expected_start = expected_clip.expected_start;
                }
            }
        }

        if (next_expected_clip)
            console.log("mbc-mosto: [INFO] next_expected clip: " + next_expected_clip.media.file + " from:" + next_expected_clip.expected_start + " to:" + next_expected_clip.expected_end );

        return expected_clip;
    }

    sync.prototype.isPlayingExpectedClip = function( expected_clip ) {
        //CHECK AND COMPARE IF WE ARE PLAYING THE EXPECTED ONE...
        console.log("COMPARE!!!" + self.player.actual_playing_status + " self.actual_playing_clip:"+self.player.actual_playing_clip + " vs expected: " + expected_clip.media.id );

        return (    self.player.actual_playing_clip != "" 
                    && (self.player.actual_playing_status == "playing" || self.player.actual_playing_status == "paused") 
                    && self.player.actual_playing_clip == expected_clip.media.id );
    }


    sync.prototype.removePlayingClips = function( index_from, index_to, successCallback, errorCallback ) {

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

    sync.prototype.appendScheduledClips = function( index_iteration ) {

        console.log("APPENDING index_iteration: " + index_iteration + " over " + scheduled_clips.length + " elements" );
        if ( 0>index_iteration || index_iteration > (scheduled_clips.length-1) ) {
            console.log("mbc-mosto: [INFO]appendScheduledClips() > APPENDING : out of bound > stop appending");
            self.timerUnlock();
            return;
        }

        var sched_clip = scheduled_clips[index_iteration];

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

};

exports = module.exports = function(config) {
    util.inherits(sync, events.EventEmitter);
    var mosto_synchronizer = new sync(config);
    return mosto_synchronizer;
};



