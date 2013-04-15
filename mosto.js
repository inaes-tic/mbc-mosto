var fs           = require('fs'),
moment           = require('moment'),
Media            = require('./api/Media'),
mvcp_server      = require('./drivers/mvcp/mvcp-driver'),   
playlists_driver = require('./drivers/playlists/playlists-driver'),
status_driver    = require('./drivers/status/pubsub'),
config           = require('./drivers/mvcp/conf/melted-node-driver');


function ScheduledMedia( media, schedule_time, schedule_duration, expected_start, expected_end ) {
    this.media   = media;
    this.schedule_time = schedule_time;
    this.schedule_duration = schedule_duration;
    this.expected_start = expected_start;
    this.expected_end = expected_end;
};

function mosto(configFile) {
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
        console.log("mbc-mosto: [INFO] Added playlist:\nname: " + playlist.name 
                    + "\nstartDate: " + playlist.startDate 
                    + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    /** updatePlaylist
     *
     *       playlist.name is the playlist key or id!
     *       update only if we are in range?! i dont want playlists scheduled for tomorrow nw!!!
     */
    mosto.prototype.updatePlaylist = function(playlist) {
        
        console.log("mbc-mosto: [INFO] Updating playlist " + playlist.name);
        var i = -1;
        self.playlists.some(function(element, index, array) {
            if (element.name === playlist.name) {
                i = index;
                return true;
            }
        });
        
        //update may create if needed
        //TODO: chech time window: startDate-endDate
        if (i==-1) {
            self.playlists.push(playlist);
        } else {
            playlist.loaded = self.playlists[i].loaded;        
            self.playlists[i] = playlist;
        }
        
        console.log("mbc-mosto: [INFO] Updated playlist:\nname: " + playlist.name 
                    + "\nstartDate: " + playlist.startDate 
                    + "\nendDate: " + playlist.endDate);
        
        self.orderPlaylists();
    };
    
    /** removePlaylist
     *       
     *
     */
    mosto.prototype.removePlaylist = function(name) {
        
        console.log("mbc-mosto: [INFO] Removing playlist " + name);
        var i = -1;
        var playlist = undefined;
        self.playlists.some(function(element, index, array) {
            if (element.name === name) {
                i = index;
                playlist = element;
                return true;
            }
        });
        self.playlists.splice(i, 1);
        console.log("mbc-mosto: [INFO] Removed playlist:\nname: " + playlist.name 
                    + "\nstartDate: " + playlist.startDate 
                    + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();

    };
    
    /** orderPlaylists      
     *       Sort playlists using startDate as key
     *
     *       
     */
    mosto.prototype.orderPlaylists = function() {
        
        console.log("mbc-mosto: [INFO] Start ordering playlists");
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Finish ordering playlists");
        //self.playPlaylists(); //this is a direct playout mode
        //self.checkoutPlaylists();
    };
    
    /**     checkoutPlaylists       
     *       checkout load next playlists if needed
     *
     *       We are using a minimum memory overhead approach to store the playlists
     *       Full playlist has a maximum of 3 hours total length starting from "now"
     *       Any older playlist are removed from memory to release memory    
     */      
    mosto.prototype.checkoutPlaylists = function() {
        console.log("mbc-mosto: checking out new playlists");   
        
        //TODO: We need here to retreive data form DB Driver... (ask for it)
        // we retreive data when: we load for the first time...         
        
        //TODO: If we are up to date, just return!! (important to avoid infinite recursions)
        
        //now we update re-convert our Scheduled Clips
        self.convertPlaylistsToScheduledClips();                
    }
    
    
    mosto.prototype.convertFramesToSeconds = function ( frames, fps ) {
        return frames/fps;
    }
    
    mosto.prototype.convertFramesToMilliseconds = function ( frames, fps ) {
        return frames * 1000.0 / fps;
    }       
    
    mosto.prototype.convertUnixToDate =  function ( unix_timestamp ) {
        //var date = new Date(unix_timestamp*1000);     
        var date = new moment(unix_timestamp);
        return date.format("hh:mm:ss");
    }

    mosto.prototype.convertDateToUnix =  function ( date_timestamp ) {
        
        var date = new moment(date_timestamp);
        return date.unix();
        
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
        
        console.log("mbs-mosto: converting Playlists to scheduled clips");
        
        //TODO: check if we need to make a checkout!
        if (self.playlists.length==0) {
            //make a checkout... (not necesarry if DB Driver take care of it??
            self.checkoutPlaylists();
            return;
        }
        
        //clean scheduled clips
        self.scheduled_clips = [];              

        var result = self.preparePlaylist( 0, 0 /**/ );
        
        //TODO: try to syncro immediatelly
        //or wait for timer synchronization
        //self.server.getServerPlaylist( self.syncroScheduledClips );

    }
    
    /** preparePlaylist
     *       recursive convert for convertPlaylistsToScheduledClips
     *
     *       @see convertPlaylistsToScheduledClips
     */
    mosto.prototype.preparePlaylist = function( next_playlist_id, endTimeCode ) {

        var pl = self.playlists[next_playlist_id];
        var i = 0;
        
        if (!validatePlaylist(pl)) {
            console.log("mbc-mosto: [ERROR] in preparePlaylist: " + pl.name );
        }
        
        if ( self.convertDateToUnix( pl.startDate ) > endTimeCode ) {
            if ( pl.mode == "snap") {
                // just add all clips with schedule: "now"
                for( i=0; i<pl.length; i++) {
                    schedule_time = "now";
                    schedule_duration = pl[i].length * pl[i].fps;
                    expected_start = "";
                    expected_end = "";
                    self.scheduled_clips.push( new ScheduledMedia( pl[i], schedule_time, schedule_duration,"", "" ) );
                }       
            } else if ( pl.mode == "fixed") {
                // just add all clips 
                i = 0;
                schedule_time = pl.startDate;
                schedule_duration = pl[i].length * pl[i].fps;
                sched_clip = new ScheduledMedia( pl[i], schedule_time, schedule_duration, "","" );
                self.scheduled_clips.push( sched_clip );
                for( i=1; i<pl.length; i++) {
                    schedule_time = "now";
                    sched_clip = new ScheduledMedia( pl[i], schedule_time, "","" );
                    self.scheduled_clips.push( sched_clip );
                }
            }
        }
        
        next_playlist_id++;             

        //iteration ended because we have no more playlists !
        if (self.playlists.length==next_playlist_id) return;

        return self.preparePlaylist( next_playlist_id );
    }
    
    
    mosto.prototype.validatePlaylist = function( playlist ) {
        for( i=0; i<playlist.length; i++) { 
            element = playlist[i];
            if ( element.fps != self.config.fps ) {                     
                console.error("Playlist is not valid! media: " + element.file + " fps:" + element.fps );                                                                                        
                return false;
            }
        };
        return true;
    }


    mosto.prototype.convertMediaFileToXmlFile = function( file ) {
        var filex = new String(file);
        var fileName = filex.substring(file.lastIndexOf("/") + 1);
        var xmlFile = config.playlists_xml_dir + "/" + fileName + ".xml";
        return '"'+xmlFile+'"'; 
    }


    
    /** playPlaylists
     *
     */      
    mosto.prototype.playPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start playing playlists");
        self.playlists.forEach(function(element, index, array) {
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
    
    /** SYNC MODULE */
    /**     syncroCurrentPlaylist
     *       
     *       compare every media scheduled in current_playlist with server  playlist
     *       
     */
    mosto.prototype.syncroScheduledClips = function( server_playing_list ) {
        
        var i = 0, j = 0;
        var min_queue_clips = 1;

        console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list = " + server_playing_list );
        console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list medias = " + server_playing_list.medias.length + " playingidx: " + self.actual_playing_index );

        //CALLING upstream (LOGIC > FETCH > function convertPlaylistsToScheduledClips() )  when...
        // conditions are:
        // 1) video server is stopped
        // 2) video server list is empty
        // 3) number of queued clips remaining is less than min_queue_clips....
        // 4) no scheduled_clips!!! we need some
        if (    !server_playing_list || server_playing_list.medias.length==0 
                ||
                self.actual_playing_status=="stopped"
                ||
                self.scheduled_clips.length===0
                ||
                ( /*hay algo cargado pero... hay menos de min_queue_clips encolados luego del actual...*/
                    server_playing_list.medias.length>0 
                        && 
                        ( (server_playing_list.medias.length-1) - self.actual_playing_index  ) < min_queue_clips                                        
                )  
           ) {
            console.log("mbc-mosto: [INFO] [SYNC MODULE] no clips playing or queued!!! calling upstream LOGIC > convertPlaylistsToScheduledClips()");

            //self.testScheduledClips();
            console.log("mbc-mosto: [INFO] len " + self.scheduled_clips.length );
            //CALLING [LOGIC] module method:
            //return self.convertPlaylistsToScheduledClips();

        }

        self.sync_lock = false;
		return; 


        //SYNC METHOD: always check:
        // 1) if video server is playing the expected clip
        // 2) if queue clips are correct
        var expected_clip = null;
        var reference_clock = null;
        self.previous_cursor_scheduled_clip = self.cursor_scheduled_clip;
        self.cursor_scheduled_clip = -1;

        //playlist has avanced
        if (self.previous_playing_index < self.actual_playing_index) {
            self.ref_sched_index = self.ref_sched_index + 1;
            self.actual_expected_start = self.scheduled_clips[ self.ref_sched_index ].expected_start;
        }


        if (self.actual_playing_frame>=0 && self.actual_expected_start) {
            
            //calculate timer_relative_clock > warning, always do the expected_start of the playing clip...                         
            self.timer_relative_clock = moment( self.actual_expected_start, "DD/MM/YYYY HH:mm:ss.SSS" ).add(self.actual_position_millis);
            self.timer_difference = moment.duration( self.timer_relative_clock - self.timer_clock ).asMilliseconds();
            console.log("mbc-mosto: [INFO] timer_clock:   " + " at:" + self.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] timer_relative_clock: " + " at:" + self.timer_relative_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
            console.log("mbc-mosto: [INFO] progress: " + self.actual_playing_progress );
            console.log("mbc-mosto: [INFO] difference: " + self.timer_difference );
        }


        console.log( "Selecting reference clock :" + self.timer_difference );
        //if diff minimal, use absolute, if diff too big using absolute > to force re-load and re-sync!
        if( Math.abs(self.timer_difference) < 20 || Math.abs(self.timer_difference) > 10000 ) {
            console.log("using absolute clock > forcing");
            reference_clock = self.timer_clock;
        } else {
            console.log("using relative clock");
            reference_clock = self.timer_relative_clock;
        }

        //SEARCH FOR SCHEDULED CLIP EXPECTED TO RUN NOW
        for( i=0; i<self.scheduled_clips.length; i++) {
            sched_clip = self.scheduled_clips[i];
            if (sched_clip) {                               
                ex_start = moment(sched_clip.expected_start,"DD/MM/YYYY HH:mm:ss.SSS");
                ex_end = moment(sched_clip.expected_end,"DD/MM/YYYY HH:mm:ss.SSS");
                if ( ex_start < reference_clock 
                     && reference_clock < ex_end ) {
                    self.cursor_scheduled_clip = i;
                    expected_clip = sched_clip;
                    break;
                }                                                       
            }       
        }

        //MANDATORY TO HAVE AN EXPECTED CLIP!!!
        if (    expected_clip
                //&& (self.previous_playing_index == self.actual_playing_index) 
                //&& (self.previous_cursor_scheduled_clip==self.cursor_scheduled_clip)
                //&& (self.actual_playing_index == self.cursor_scheduled_clip)                          
                //&& self.actual_playing_progress > 0.01 && self.actual_playing_progress < 0.99
           ) {

            console.log("mbc-mosto: [INFO] expected clip: " + expected_clip.media.file + " from:" + expected_clip.expected_start + " to:" + expected_clip.expected_end );


            // CHECK AND COMPARE IF WE ARE PLAYING THE EXPECTED ONE...
            console.log("COMPARE!!! self.actual_playing_clip:"+self.actual_playing_clip + " vs expected: " + self.convertMediaFileToXmlFile(expected_clip.media.file) );
            if ( Math.abs(self.timer_difference)<10000
                 && self.actual_playing_clip 
                 && self.actual_playing_status == "playing"
                 && self.actual_playing_clip == self.convertMediaFileToXmlFile(expected_clip.media.file) ) {

                console.log(" We are playing the expected clip !! ");                           

                var breakpoint_playing_cursor = -1;
                var breakpoint_scheduled_cursor = -1;
                var need_sync_clips = false;
                //LETS CHECK THE OTHERS....
                //TODO: check maybe if we have enough time int this clip to check the full list...
                //console.log(" check  the others !! ");

                self.scheduled_clips_index_last_to_queue = 0;

                //PARSE scheduled clips, calculate actual clips to be queued
                /*
                  for( j=self.cursor_scheduled_clip+1; j<self.scheduled_clips.length; j++ ) {
                  var scheduled_c = self.scheduled_clips[j];
                  if (scheduled_c.schedule_time!="now") {
                  self.scheduled_clips_index_last_to_queue = j-1;
                  console.log("mbc-mnostp: [INFO] [SYNC] clips to be queued: " + self.scheduled_clips_index_last_to_queue );
                  }
                  }
                */


                for( i=self.actual_playing_index,j=self.cursor_scheduled_clip; i<server_playing_list.medias.length && j<self.scheduled_clips.length; i++,j++) {
                    //COMPARE EACH ONE
                    //media on video server
                    var queued_media = server
_playing_list.medias[i];
                    //media expected in mosto
                    var scheduled_media = self.scheduled_clips[j].media;

                    var ff = self.convertMediaFileToXmlFile(scheduled_media.file);
                    var comparison = queued_media.file != ff;

                    breakpoint_playing_cursor = i;
                    breakpoint_scheduled_cursor = j;

                    //console.log("CHECK OTHERS: i:" +i + " j:" + j );
                    //console.log("CHECK OTHERS: COMPARING " + queued_media.file + " vs " + ff + " com:" + comparison );
                    
                    //CHECK IF WE REACH AN INCOHERENCE
                    if ( comparison ) {                                             
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
                    self.removePlayingClips(  breakpoint_playing_cursor, server_playing_list.medias.length-1,
                                              function() {
                                                  console.log("mbc-mosto: [INFO] [SYNC] self.removePlayingClips ok, now appendScheduledClips from index:  " + breakpoint_playing_cursor );
                                                  self.appendScheduledClips( breakpoint_scheduled_cursor );
                                              },
                                              function(error) {
                                                  console.log("mbc-mosto: [ERROR] [SYNC] removePlayingClips > error:"+error );
                                                  self.sync_lock = false;
                                              }
                                           );
                }
                else self.sync_lock = false;                            

            } else {
                //WE ARE NOT PLAYING THE EXPECTED ONE (OR NOT A THE EXPECTED POSITION) !!!
                // LOAD EVERYTHING STARTING FROM THE EXPECTED CLIP

                //clean playlist (doesnt matter, we are stopped)... then populate...
                self.server.clearPlaylist( function(response) {                                         
                    console.log("clearPlaylist ok! " + response ); 
                    sched_clip = self.scheduled_clips[self.cursor_scheduled_clip];
                    self.server.loadClip( sched_clip.media, function(response) {
                        //EASY only C from CRUD
                        self.server.play(  function(response) {
                            console.log("LOADED start playing!");
                            self.actual_expected_start = sched_clip.expected_start;
                            self.ref_sched_index = self.cursor_scheduled_clip;
                            self.appendScheduledClips( self.cursor_scheduled_clip+1 );
                        }, 
                                           function(error) {
                                               console.error("error start playing:"+error); 
                                               self.sync_lock = false;
                                           } );

                    },
                                          function(error) {
                                              console.error("error loading clip:"+error); 
                                              self.sync_lock = false;         
                                          } );
                },
                                           function(error) { 
                                               console.error("error clearing playlist:"+error); 
                                               self.sync_lock = false;
                                           } );

                
                
            }
        } else {
            console.log("mbc-mosto: [INFO] [WARNING] no expected clip ! ");
            self.sync_lock = false; 
        }


        
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
        if ( index_iteration > (self.scheduled_clips.length-1) ) {
            console.log("APPENDING : out of bound > stop appending");
            self.sync_lock = false;
            return;
        }
        
        sched_clip = self.scheduled_clips[index_iteration];

        if ( index_iteration>0 && sched_clip.schedule_time!="now") {
            //we break the loading loop at second appearance of a non-queued media...
            //so we must wait to the timer to call it automatically
            //WARNING!!! snap was done in convertPlaylists -> preparePlaylist
            console.log("APPENDING : stop appending, schedule_time is not now: " + sched_clip.schedule_time);
            self.sync_lock = false;
            return;                                         
        } else index_iteration++;

        self.server.appendClip( sched_clip.media, function(response) {
            console.log("Iteration:" + index_iteration + " Append ok media " + sched_clip.media.file + " resp:" + response);                                        
            self.appendScheduledClips( index_iteration );
        },
                                function(error) {
                                    console.error("error appending clip:"+error);                                                   
                                    self.sync_lock = false
                                }
                              );                              

    }

    /** PLAY MODULE*/
    /**
     *       start timer: not necessarelly frame accurate, interval: 200 ms 
     *
     */

    mosto.prototype.timer_fun_status = function( actual_status ) {

        self.previous_playing_index = self.actual_playing_index;

        self.actual_status = actual_status;

        self.actual_playing_clip = self.actual_status.file;
        self.actual_playing_status = self.actual_status.status;
        self.actual_playing_index = self.actual_status.index;
        self.actual_playing_clips = self.actual_status.clips;
        self.actual_playing_frame = self.actual_status.currentFrame;
        self.actual_playing_length = self.actual_status.length;
        self.actual_playing_fps = self.actual_status.fps.replace(",",".");

        position_millis = self.convertFramesToMilliseconds( self.actual_playing_frame, self.actual_playing_fps);
        self.actual_position_millis = moment.duration( { milliseconds: position_millis } );

        if (self.actual_playing_length>0) 
          self.actual_playing_progress = (1.0 * self.actual_playing_frame) / (1.0 * self.actual_playing_length);
        else
          self.actual__playing_progress = 0.0;

        console.log("mbc-mosto: [INFO] timer_fun_status status: " + self.actual_playing_status + " clip: " + self.actual_playing_clip );

/*		
		 meltedStatus = {

			  clip: {
				  previous = position in list
				  current = position in list
				  next = position in list
			  },

			  show: {
				  previous = Playlist
				  current = Playlist
				  next = Playlist
			  }

			  position = playback % of current

			  clips = [clip list]
		  };
*/	
/*
meltedStatus = {
  clip: {
    previous: posicion en la lista,
    current: posicion en la lista,
    next: posicion en la lista
  },
  show: {
    previous = Playlist
    current = Playlist
    next = Playlist
  }
  position = playback % of current
  clips = [clip list]
};
*/
		//self.status_driver.setStatus( meltedStatus );

        //we have a status let's get synchronized...
        //TODO: check errors !

        self.server.getServerPlaylist( self.syncroScheduledClips, function() { console.log("mbc-mosto: [ERROR] timer_fun_status >  getServerPlaylist() " ); } );                
        
    }

    mosto.prototype.timer_fun = function() {

        if (!self.sync_lock) {
            //TODO: call sync and send status message to channels...

            //calculate now time...
            self.timer_clock = moment();
            self.sync_lock = true;

            console.log("mbc-mosto: [INFO] timer_fun called: " + self.timer_clock.format("hh:mm:ss") );

            //get status
            self.server.getServerStatus( self.timer_fun_status, function( error ) { console.log("mbc-mosto: [ERROR] mosto.timer_fun > getServerStatus failed: " + error ); } );
        } else console.log("sync LOCKED");
    }

    mosto.prototype.play = function() {
        //TODO: check play state                
        //start timer
        console.log("mbc-mosto: [INFO] Start playing mosto");

        if (!self.timer) {
            //self.timer = pauseable.setInterval( self.timer_fun, self.config.timer_interval );
            self.timer = setInterval( self.timer_fun, self.config.timer_interval );
        }

        //self.timer.resume();
        //console.log("mbc-mosto: [INFO] Start timer: " + self.timer.IsPaused() );
        
    }
    
    mosto.prototype.stop = function() {
        self.timer.clear();
        self.timer = null;
    }

    mosto.prototype.pause = function() {
        //TODO: need more testing...
        //self.timer.pause();
    }
    
    mosto.prototype.startWatching = function() {
        
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile);
        fs.watch(self.configFile, function(event, filename) {
            if (event === 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            this.config = require(this.configFile);
        });
    };
    
    mosto.prototype.initDriver = function() {

        console.log("mbc-mosto: [INFO] Initializing playlists driver");

        self.driver.registerNewPlaylistListener(self.addPlaylist);
        self.driver.registerUpdatePlaylistListener(self.updatePlaylist);
        self.driver.registerRemovePlaylistListener(self.removePlaylist);

        self.driver.start();
    };
    
    mosto.prototype.startMvcpServer = function(callback) {
        var result = self.server.initServer();
        result.then(function() {
            callback();
        });
    };
    
    
    /** CONFIGURATION */ 
    this.configFile = configFile;
    this.config     = false;    
    this.default_config = {
        "fps": "30", 
        "resolution": "hd", 
        "playout_mode": "direct",
        "playlists_maxlength": "24:00:00",
        "scheduled_playlist_maxlength": "04:00:00",
        "timer_interval": "00:00:00"
    };
    
    /**     FETCH MODULE*/
    this.playlists  = []; // this is the scheduled playlists....in a range between now and max_playlist_duration
    this.time_window_from = "";
    this.time_window_to = "";
    
    /** LOGIC MODULE*/
    this.scheduled_clips = []; //here we must have the current playlist up to date...       
    
    
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
    this.timer_clock = null;
    this.timer_relative_clock = null;
    this.timer_expected_clock = null;
    this.timer_difference = 0;

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
    
    /** ALL MODULES */
    
    if (!this.configFile)
        this.configFile = './config.json';
    
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);     
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    this.server     = new mvcp_server(this.config.mvcp_server);
    this.driver     = new playlists_driver(this.config.playlist_server);
	this.status_driver = status_driver();

    self.startMvcpServer(function() {        
        self.startWatching();
        self.initDriver();
        self.play();
    });
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
