var fs               = require('fs'),
    util             = require('util'),
    utils            = require('./utils'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia'),
    StreamerCom      = require('./api/StreamerCom');

function sync( config ) {

    StreamerCom.call(this);

    this.name = "synchronizer";
    this.mosto = config.mosto;
    this.server = config.mosto.server;

    this.scheduler = undefined;
    this.player = undefined;

    /** SYNC MODULE */
    this.actual_server_playlist = [];
    this.cursor_playing_clip = -1;
    this.cursor_next_clip = -1;

    this.scheduled_clips_index_last_to_queue = -1;
    this.cursor_scheduled_clip = -1;
    this.previous_cursor_scheduled_clip = -1;
    this.ref_sched_index = -1;

    this.sched_clips = [];

}

sync.prototype = new StreamerCom();

sync.prototype.init = function() {

    var self = this;

    this.scheduler = this.mosto.scheduler;
    this.player = this.mosto.player;

    self.on( 'datareceived' , function(data) {
        console.log("mbc-mosto: [INFO] [SYNC] ["+self.name+"] 'datareceived' downstream DATA received. data:" + data + " datareceived:" + self.DataReceived() + " dataBuffer:" + self.dataBuffer + " rec_count:" + self.rec_count + " ret_count:" + self.ret_count );
//        console.log(data);
//        console.log("Inspecting self 'synchronizer': " + util.inspect( self, true, 2));
    });

    self.on( 'dataupdated' , function(streamer) {
        console.log("mbc-mosto: [INFO] [SYNC] Propagating from " + streamer + " to player");
        if (self.player) self.player.emit('dataupdated',streamer);
    });


    if (this.scheduler) this.scheduler.on( 'sched_downstream', function( scheduled_clips ) {
            console.log("mbc-mosto: [INFO] [SYNC] receiving sched_downstream.");
            console.log(self);
    });

    if (self.player) self.player.on( 'play_upstream', function(play_status) {
        console.log("mbc-mosto: [INFO] [SYNC] receiving play_upstream: calling upstreamCheck");
        self.upstreamCheck( self, play_status );
    } );

    //open data receiver
    if (self.Open( self ) && self.IsReceiving()) {
        console.log('mbc-mosto: [INFO] [SYNC] Opened');
    } else throw new Error("mbc-mosto: [ERROR] [SYNC] couldn't open StreamerCom");

}

sync.prototype.timerUnlock = function( mess ) {
    console.log("mbc-mosto: [INFO] [SYNC] Unlocking from " + mess);
    this.player.timerUnlock();
}

sync.prototype.timerLock = function(mess) {
    console.log("mbc-mosto: [INFO] [SYNC] Locking from " + mess);
    this.player.timerLock();
}

sync.prototype.timerLocked = function() {
    return this.player.timerLocked();
}


sync.prototype.validatePlaylist = function( playlist ) {
    for( var i=0; i<playlist.length; i++) {
        element = playlist[i];
        if ( element.fps != this.config.fps ) {
            console.error("Playlist is not valid! media: " + element.file + " fps:" + element.fps );
            return false;
        }
    };
    return true;
};

sync.prototype.convertMediaFileToClipId = function( media ) {
    return media.id;
};


sync.prototype.upstreamCheck = function( self, player_status ) {

    //CALLING upstream when clips are needed...
    // var self = this;
    var server_playlist = player_status.server_playlist;
    var server_status = player_status.server_status;
    var server_previous_status = player_status.server_previous_status;


    /*Condicion 0: data has been updated upstream: need an upstream check upstream*/
    var Condition_0 = self.DataUpdatedUpstream();

    /*Condicion 1: Es condicion que haya datos recibidos nuevos para sincronizar.... */
    var Condition_1 = self.DataReceived();

    /*Condicion 2: Si hay un clip esperado, verificar que se esta reproduciendo el clip correcto y el cuadro correcto */
    var expected_clip = self.getExpectedClip( server_status, server_previous_status, self.sched_clips );
    var is_playing_ex = self.isPlayingExpectedClip( server_status, expected_clip );
    var Condition_2 = (expected_clip!==undefined);

    /*Condicion 3: Not enough clips... */
    var Condition_3 = self.ineedMoreClips( server_playlist, server_status, self.sched_clips, 1 );

    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : Condition_0 : " + Condition_0);
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : Condition_1 : " + Condition_1);
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : Condition_2 : " + Condition_2);
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : Condition_3 : " + Condition_3);

    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : expected_clip : " + expected_clip);
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : is_playing_ex : " + is_playing_ex);
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : self.sched_clips : " + self.sched_clips.length );
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : server_status : " + server_status.status );
    console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() : server_status.actualClip : " + server_status.actualClip );

    if ( Condition_0 ) {
        console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() > Condition 0: stream data changed");
        self.emit('sched_upstream');
        self.DataUpdatedReset();
    } else
    if ( Condition_1 ) {
        console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() > Condition 1: DataReceived() " + Condition_1 );
        self.sched_clips = self.RetreiveData( self );
        self.syncroScheduledClips( self, self.sched_clips, server_playlist, player_status );
    }
    else
    if ( Condition_2) {
        console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() > Condition 2: We are playing the expected clip ("+is_playing_ex+")  of expected_clip("+expected_clip.media.id+"): " + Condition_2 );
        self.syncroScheduledClips( self, self.sched_clips, server_playlist, player_status );
    }
    else
    if ( Condition_3 ) {
        console.log("mbc-mosto: [INFO] [SYNC] upstreamcheck() > Condition 3: i'm hungry, i need more clips!!! emitting sched_upstream");
        self.emit('sched_upstream');//no message needed...
    } else self.timerUnlock(" upstreamCheck > no upstream nor synchronization needed.");
};


/** SYNC MODULE */
/**     syncroScheduledClips
 *
 *       compare every media scheduled in current_playlist with server  playlist
 *
 */
sync.prototype.syncroScheduledClips = function( self, scheduled_clips, server_playing_list, player_status ) {

//    var self = this;

    console.log("mbc-mosto: [INFO] [SYNC] syncroScheduledClips > server_playing_list medias = " + server_playing_list.length + " playingidx: " + this.player.actual_playing_index );

    self.emit('syncing', server_playing_list );

    self.actual_server_playlist = server_playing_list;
    self.sched_clips = scheduled_clips;

    var server_status = player_status.server_status;
    var server_previous_status = player_status.server_previous_status;

    //SYNC METHOD: always check:
    // 1) if video server is playing the expected clip
    // 2) if queue clips are correct
    var expected_clip = self.getExpectedClip( server_status, server_previous_status, scheduled_clips );

    // DO WE HAVE AN EXPECTED CLIP ?
    if ( expected_clip ) {

        console.log("mbc-mosto: [INFO] expected clip: " + expected_clip.media.file + " from:" + expected_clip.expected_start + " to:" + expected_clip.expected_end );

        // IS IT PLAYING IN SERVER ?
        if ( self.isPlayingExpectedClip( server_status, expected_clip ) ) {

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

                if ( (server_playing_list.length-breakpoint_playing_cursor) < ( self.scheduled_clips_index_last_to_queue - breakpoint_scheduled_cursor) ) {
                    need_sync_clips = true;
                }

                // REMOVE PLAYING CLIPS: WIPE AFTER BREAKING CURSOR....
                // AND ADD MISSING SCHEDULED CLIPS
                if (need_sync_clips!=need_sync_clips) {
                    console.log("mbc-mosto: [INFO] [SYNC] this.removePlayingClips after index: " + breakpoint_playing_cursor );
                    self.removePlayingClips(  self, breakpoint_playing_cursor, server_playing_list.length-1,
                                              function() {
                                                  console.log("mbc-mosto: [INFO] [SYNC] this.removePlayingClips ok, now appendScheduledClips from index:  " + breakpoint_playing_cursor );
                                                  self.appendScheduledClips( self, scheduled_clips, breakpoint_scheduled_cursor );
                                              },
                                              function(error) {
                                                  console.error("mbc-mosto: [ERROR] [SYNC] removePlayingClips > error:"+error );
                                                  self.emit('sync_downstream');
                                                  self.emit('synced', 'finished ' );
                                                  self.timerUnlock();
                                              }
                                           );
                } else {
                    self.emit('sync_downstream');
                    self.emit('synced', 'finished ' );
                    self.timerUnlock(" [SYNC] synchroScheduledClips");
                }
            }
            self.emit('sync_downstream');
            self.emit('synced', 'finished ' );
            self.timerUnlock(" [SYNC] synchroScheduledClips");

        } else {
            //WE ARE NOT PLAYING THE EXPECTED ONE SO WE CLEAN UP AND LOAD/GOTO EXPECTED ONE
            console.log("mbc-mosto: [INFO] [SYNC] cleanPlaylist ");
            self.server.cleanPlaylist( function(response) {
                console.log("mbc-mosto: [INFO] [SYNC] cleanPlaylist ok! " + response );
                var sched_clip = scheduled_clips[ self.cursor_scheduled_clip ];
                self.server.appendClip( sched_clip.media, function(response) {
                    var next_index = 0;
                    if ( self.player.actual_playing_index>-1 ) {
                        next_index = self.player.actual_playing_index+1;
                    }
                    self.server.goto( next_index, expected_clip.expected_frame, function(resp1) {
                        console.log("mbc-mosto: [INFO] [SYNC] GOTO : index:" + next_index + " frame:" + expected_clip.expected_frame + " resp1:" + resp1);
                        self.server.play(  function(resp2) {
                            console.log("mbc-mosto: [INFO] [SYNC] LOADED -> now PLAY: start playing!" + resp2);
                            self.actual_expected_start = sched_clip.expected_start;
                            self.player.actual_playing_index = next_index;
                            self.player.previous_playing_index = next_index;
                            self.ref_sched_index = self.cursor_scheduled_clip;
                            self.previous_cursor_scheduled_clip = -1;
                            self.appendScheduledClips( self, scheduled_clips, self.cursor_scheduled_clip+1 );
                        },
                                       function(error) {
                                           console.error("mbc-mosto: [ERROR] error goto :"+error);
                                           self.emit('synced', 'finished ' );
                                           self.emit('sync_downstream');
                                           self.timerUnlock("error synchronizing > goto");
                                       } );

                    },
                                       function(error) {
                                           console.error("mbc-mosto: [ERROR] error start playing:"+error);
                                           self.emit('synced', 'finished ' );
                                           self.emit('sync_downstream');
                                           self.timerUnlock("error synchronizing > start playing");
                                       } );

                },
                                      function(error) {
                                          console.error("mbc-mosto: [ERROR] error loading clip:"+error);
                                          self.emit('synced', 'finished ' );
                                          self.emit('sync_downstream');
                                          self.timerUnlock("error synchronizing > loading clip");
                                      } );
            },
                                       function(error) {
                                           console.error("mbc-mosto: [ERROR] error cleaning playlist:"+error);
                                           self.emit('synced', 'finished ' );
                                           self.emit('sync_downstream');
                                           self.timerUnlock("error synchronizing > cleaning playlist");
                                       } );



        }
    } else {
        //IF THERE IS NO EXPECTED CLIP > WE MUST HAVE OUR BLANK MOVIE PLAYING
        console.log("mbc-mosto: [WARNING] [SYNC] no expected clip right now! (CHECK IF BLACK IS PLAYING OR PAUSED)");
        if ( self.player.actual_playing_clip == 'black_id'  ) {
            console.log("mbc-mosto: [INFO] [SYNC] FILLED WITH BLACK OK...");
        } else {
            console.log("mbc-mosto: [WARNING] [SYNC] NOT BLACK!!! calling upstream scheduler... to fix it ASAP.");
            self.emit( 'sched_upstream' );
        }
        self.emit('sync_downstream');
        self.emit('synced', 'finished ' );
        self.timerUnlock("synchronizing > no expected clip");

    }

}

sync.prototype.ineedMoreClips = function( server_playing_list, server_status, scheduled_clips, min_queue_clips ) {
    // conditions are:
    // 1) video server is stopped
    // 2) video server list is empty
    // 3) video server list is not empty but number of queued clips remaining is less than min_queue_clips
    // 4) there are no scheduled_clips!!! we need some!!!

    var queued_clips = 0;

    if (server_status.actualClip && server_playing_list.length>0)
        queued_clips = (server_playing_list.length-1) - server_status.actualClip.order;

    console.log("mbc-mosto: [INFO] [SYNC] ineedMoreClips ? : lists:"+server_playing_list.length + " status:" + server_status.status + " sched_clips:" + scheduled_clips.length + " queued:" +   queued_clips );

    return (    !server_playing_list
                ||
                server_playing_list.length==0
                ||
                server_status.status=="stopped"
                ||
                scheduled_clips.length===0
                ||
               /*hay algo cargado pero... hay menos de min_queue_clips encolados luego del actual...*/
                queued_clips < min_queue_clips );

}

sync.prototype.getExpectedClip = function( server_status, server_previous_status, scheduled_clips ) {

    console.log("mbc-mosto: [INFO] [SYNC] getExpectedClip called");

    var expected_clip = undefined;

    var next_expected_clip = null;
    var next_expected_start = null;
    var expected_frame = 0;
    var reference_clock = null;

    this.previous_cursor_scheduled_clip = this.cursor_scheduled_clip;
    this.cursor_scheduled_clip = -1;

    /** CALCUTALE NEW RELATIVE CLOCK (based on video server index and expected clip start time */
    //playlist has avanced
    if ( this.player.previous_playing_index < this.player.actual_playing_index && this.player.actual_playing_status == "playing" ) {
        this.ref_sched_index = this.ref_sched_index + 1;
        var exp_clip = scheduled_clips[ this.ref_sched_index ];
        if (exp_clip) {
            this.player.actual_expected_start = exp_clip.expected_start;
            console.log("mbc-mosto: [INFO] [SYNC] changed index from: " + this.player.previous_playing_index + " to " + this.player.actual_playing_index + " this.ref_sched_index:  "  + this.ref_sched_index  );
        } else console.error("mbc-mosto: [ERROR] [SYNC] getExpectedClip > ref_sched_index out of bound. " + this.ref_sched_index + " not in (0.." + (scheduled_clips.length-1) + ")" );
    }

    if (this.player.actual_playing_frame>=0 && this.player.actual_expected_start && this.player.actual_position_millis_length>1) {
        //calculate timer_relative_clock > warning, always do the expected_start of the playing clip...
        this.player.timer_relative_clock = moment( this.player.actual_expected_start, "DD/MM/YYYY HH:mm:ss.SSS" ).add(this.player.actual_position_millis);
        this.player.timer_difference = moment.duration( this.player.timer_relative_clock - this.player.timer_clock ).asMilliseconds();
        console.log("mbc-mosto: [INFO] [SYNC] timer_clock         " + " at:" + this.player.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
        console.log("mbc-mosto: [INFO] [SYNC] timer_relative_clock" + " at:" + this.player.timer_relative_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
        console.log("mbc-mosto: [INFO] [SYNC] progress: " + this.player.actual_playing_progress );
        console.log("mbc-mosto: [INFO] [SYNC] difference: " + this.player.timer_difference );
    } else this.player.timer_difference = 0; //back to absolute clocking (we are stopped)


    console.log( "mbc-mosto: [INFO] [SYNC] Selecting reference clock :" + this.player.timer_difference );

    //if diff minimal, use absolute, if diff too big using absolute > to force re-load and re-sync!
    if( Math.abs(this.player.timer_difference) < 20 || Math.abs(this.player.timer_difference) > 10000 ) {
        console.log("mbc-mosto: [INFO] [SYNC] using absolute clock > forcing");
        reference_clock = this.player.timer_clock;
    } else {
        console.log("mbc-mosto: [INFO] [SYNC] using relative clock");
        reference_clock = this.player.timer_relative_clock;
    }
    //reference_clock = this.timer_clock;


    console.log("mbc-mosto: [INFO] [SYNC] reference_clock         " + " at:" + reference_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );

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
                && expected_clip==undefined) {
                this.cursor_scheduled_clip = i;
                expected_clip = sched_clip;
                // TODO: calculate frame position! based on length.
                expected_frame = utils.getFramePositionFromClock( reference_clock, ex_start, 0, 25.00 );
                if ( expected_frame == undefined || expected_clip.media.id=="black_id") expected_frame = 0;
                expected_clip.expected_frame = parseInt(expected_frame);
                this.player.actual_expected_start = expected_clip.expected_start;
            }
        }
    }

    if (next_expected_clip)
        console.log("mbc-mosto: [INFO] [SYNC] next_expected clip: " + next_expected_clip.media.file + " from:" + next_expected_clip.expected_start + " to:" + next_expected_clip.expected_end );

    return expected_clip;
}

sync.prototype.isPlayingExpectedClip = function( server_status, expected_clip ) {
    //CHECK AND COMPARE IF WE ARE PLAYING THE EXPECTED ONE...
//    console.log("mbc-mosto: [INFO] [SYNC] COMPARE!!!" + server_status.status + " actual_playing_clip:"+server_status.actualClip + " vs expected: " + expected_clip.media.id );
    return (    server_status.actualClip
                && expected_clip
                && server_status.actualClip.id != ""
                && (server_status.status == "playing" || ( server_status.status == "paused" && server_status.actualClip.id=='black_id' ) )
                && server_status.actualClip.id  == expected_clip.media.id );
}


sync.prototype.removePlayingClips = function( self, index_from, index_to, successCallback, errorCallback ) {

    if ( index_from > index_to ) {
        return successCallback();
    }

    this.server.removeClip( index_from, function(response) {
            index_from++;
            self.removePlayingClips( self, index_from, index_to, successCallback, errorCallback);
        },
        function(error) {
            errorCallback(error);
        }
    );

}

sync.prototype.appendScheduledClips = function( self, scheduled_clips, index_iteration ) {

    if (! ( scheduled_clips ) ) {
        console.error("mbc-mosto: [ERROR] [SYNC] appendScheduledClips: " + scheduled_clips);
        self.emit('sync_downstream');
        self.emit('synced', 'finished ' );
        return self.timerUnlock(" appendScheduledClips > no scheduled clips");
    }

    console.log("mbc-mosto: [INFO] [SYNC] appendScheduledClips: APPENDING index_iteration: " + index_iteration + " over " + scheduled_clips.length + " elements" );
    if ( index_iteration<0 || index_iteration > (scheduled_clips.length-1) ) {
        console.log("mbc-mosto: [INFO] [SYNC] appendScheduledClips() > APPENDING : out of bound > stop appending");
        self.emit('sync_downstream');
        self.emit('synced', 'finished ' );
        return self.timerUnlock(" appendScheduledClips > index_iteration out of bound");
    }

    var sched_clip = scheduled_clips[index_iteration];

    if ( index_iteration>0 && sched_clip.schedule_time!="now") {
        //we break the loading loop at second appearance of a non-queued media...
        //so we must wait to the timer to call it automatically
        //WARNING!!! snap was done in convertPlaylists -> preparePlaylist
        console.log("mbc-mosto: [INFO] [SYNC] APPENDING : stop appending, schedule_time is not now: " + sched_clip.schedule_time);
        self.emit('sync_downstream');
        self.emit('synced', 'finished ' );
        return self.timerUnlock(" appendScheduledClips > stop appending non queued clips");
    } else index_iteration++;

    self.server.appendClip( sched_clip.media, function(response) {
            console.log("mbc-mosto: [INFO] [SYNC] appendScheduledClips() Iteration:" + index_iteration + " Append ok media " + sched_clip.media.file + " resp:" + response);
            self.appendScheduledClips( self, scheduled_clips, index_iteration );
        },
        function(error) {
            console.error("mbc-mosto: [ERROR] [SYNC] appendScheduledClips() Error appending clip:"+error);
            self.emit('sync_downstream');
            self.emit('synced', 'finished ' );
            self.timerUnlock("appendScheduledClips > error append clip ");
        }
      );

}

exports = module.exports = function(config) {
    var mosto_synchronizer = new sync(config);
    mosto_synchronizer.ResetListeners();
    return mosto_synchronizer;
};



