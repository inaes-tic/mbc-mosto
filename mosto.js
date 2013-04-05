var fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 	
	playlists_driver = require('./drivers/playlists/playlists-driver');

var pauseable = require('pauseable')
  , EventEmitter = require('events').EventEmitter;
    
function ScheduledClip( media, schedule_time, schedule_duration, expected_start, expected_end ) {
    this.media   = media;
	this.schedule_time = schedule_time;
	this.schedule_duration = schedule_duration;
	this.expected_start = expected_start;
	this.expected_end = expected_end;
};
	
function mosto(configFile) {
    var self = this;


	/** FETCH MODULE */
       	   
	/** addPlaylist
	*
	*	add a new playlist
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
	*	playlist.name is the playlist key or id!
	*	update only if we are in range?! i dont want playlists scheduled for tomorrow nw!!!
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
        playlist.loaded = self.playlists[i].loaded;
        self.playlists[i] = playlist;
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
	*	Sort playlists using startDate as key
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
		self.checkoutPlaylists();
    };
	
	/**	checkoutPlaylists	
	*	checkout load next playlists if needed
	*
	*	We are using a minimum memory overhead approach to store the playlists
	*	Full playlist has a maximum of 3 hours total length starting from "now"
	*	Any older playlist are removed from memory to release memory	
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
		//return frames/fps;
	}
	
	mosto.prototype.convertFramesToMiliseconds = function ( frames, fps ) {
		//return frames*1000.0 / fps;
	}	
	
	mosto.prototype.convertUnixToDate =  function ( unix_timestamp ) {
		var date = new Date(unix_timestamp*1000);	
		//return date.getHours()+":"+ date.getMinutes() + ":" date.getSeconds();
	}

	mosto.prototype.convertDateToUnix =  function ( date_timestamp ) {
	
		var date = new Date(date_timestamp);
		//return date.getTime()/1000;
	
	}
				

	/** LOGIC MODULE */

	/** convertPlaylistsToScheduledClips
	*
	* here we make all the necesarry calculations and update the current playlist
	* maybe create some warning messages
	* check coherence in scheduled playlists
	* add playlist_attribute= {} in Playlist.js
	*
	* case 0: no playlist available
	*	see modes: snap | fixed		
	* case 1: next playlist is overlapped
	*	see modes: snap | fixed
	* case 2: next playlist start more than xx seconds after this one
	*	see modes: snap | fixed
	*
	*	We use a recursive function preparePlaylist	
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
	*	recursive convert for convertPlaylistsToScheduledClips
	*
	*	@see convertPlaylistsToScheduledClips
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

		if (self.playlists.length==next_playlist_id) return;

		return self.preparePlaylist( next_playlist_id );
	}
	
	
	mosto.prototype.validatePlaylist = function( playlist ) {
		for( i=0; i<playlist.length; i++) { 
			element = playlist[i];
		    if ( element.fps != self.config.fps ) {			
				console.log("Playlist is not valid! media: " + element.file + " fps:" + element.fps );											
				return false;
            }
        };
		return true;
	}


	/** SYNC MODULE */

	
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
	
	/**	syncroCurrentPlaylist
	*	
	*	compare every media scheduled in current_playlist with server  playlist
	*	
	*/
	mosto.prototype.syncroScheduledClips = function( server_playing_list ) {
	
		var i = 0;

		console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list = " + server_playing_list );
		console.log("mbc-mosto: [INFO] syncroScheduledClips > server_playing_list medias = " + server_playing_list.medias.length );


		self.now = moment();

		//Real sync method:
		var expected_clip = null;
		//SEARCH FOR SCHEDULED CLIP EXPECTED TO RUN NOW
		for( i=0; i<self.scheduled_clips.length; i++) {
			expected_clip = self.scheduled_clips[i];				
			if (sched_clip.expected_start < self.now && self.now < sched_clip.expected_end ) {
 				self.cursor_scheduled_clip = i;
				break;
			}				
		}

		//MANDATORY TO HAVE AN EXPECTED CLIP!!!
		if (expected_clip) {
			// CHECK AND COMPARE IF WE ARE PLAYING THE EXPECTED ONE...
			if ( self.actual_playing_clip && self.actual_playing_clip.file == expected_clip.media.file ) {

				var breakpoint_playing_cursor = -1;
				var breakpoint_scheduled_cursor = -1;
				//LETS CHECK THE OTHERS....
				//TODO: check maybe if we have enough time int this clip to check the full list...
				for( i=self.actual_playing_clip.index,j=self.cursor_scheduled_clip; i<server_playing_list.medias.length,j<self.scheduled_clips.length; i++,j++) {
					//compara one by one... 
					queued_media = server_playing_list.medias[i];
					scheduled_media = self.scheduled_clips[j];
					if (queued_media.file != scheduled_media.file ) {
						//record he cursors
						breakpoint_playing_cursor = i;
						breakpoint_scheduled_cursor = j;
						break;
					}
				}

				//REMOVE PLAYING CLIPS: WIPE AFTER BREAKING CURSOR....
				//TODO: check errors !!!
				for( i = breakpoint_playing_cursor; i<server_playing_list.medias.length; i++ ) {
					self.server.removeClip( i );				
				}

				//ADD MISSING SCHEDULED CLIPS
				//TODO: check errors !!!
				for( j = breakpoint_scheduled_cursor; j<self.scheduled_clips.length; j++ ) {
					scheduled_media = self.scheduled_clips[j];
					self.server.appendClip( scheduled_media );				
				}
				
				
			
			} else {
				//IF NOT FULL LOAD THEN!!!

				//clean playlist (doesnt matter, we are stopped)...
				self.server.cleanPlaylist();

				sched_clip = self.scheduled_clips[i];
				self.server.loadClip( sched_clip.media );

				//EASY only C from CRUD
				for( i=1; i < self.scheduled_clips.length; i++ ) {
				
					sched_clip = self.scheduled_clips[i];

					self.server.appendClip( sched_clip.media );
				
					
					//we break the loading loop at second appearance of a non-queued media...
					//so we must wait to the timer to call it automatically
					//WARNING!!! snap was done in convertPlaylists -> preparePlaylist
					if ( i>0 && sched_clip.schedule_time!="now") {
						break;
					}
				
				}
				
						
			}
		}

	
	}
	


	/** PLAY MODULE*/
	/**
	*	start timer: not necessarelly frame accurate, interval: 200 ms 
	*
	*/

	mosto.prototype.timer_fun_status = function( actual_clip ) {


		self.actual_playing_clip = actual_clip;

		//we have a status let's get synchronized...
		self.server.getServerPlaylist( self.syncroScheduledClips );

	}

	mosto.prototype.timer_fun = function() {
		//TODO: call sync and send status message to channels...
		console.log("mbc-mosto: [INFO] sync_func called");

		//get status
		self.server.getServerStatus( self.timer_fun_status, function() { console.log("mbc-mosto: [ERROR] mosto.timer_fun > getServerStatus failed."); } );

		//calculate now time...

	}

	mosto.prototype.play = function() {
		//TODO: check play state		
		//start timer
		console.log("mbc-mosto: [INFO] Start playing mosto");
		if (!self.timer) 
			self.timer = pauseable.setInterval( self.timer_fun, self.config.timer_interval );
		self.timer.resume();
		console.log("mbc-mosto: [INFO] Start timer: " + self.timer.IsPaused() );
			
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

        self.driver.registerNewPlaylistListener(self.logic.addPlaylist);
        self.driver.registerUpdatePlaylistListener(self.logic.updatePlaylist);
        self.driver.registerRemovePlaylistListener(self.logic.removePlaylist);

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
		"fps": "25", 
		"resolution": "hd", 
		"playout_mode": "direct",
		"playlists_maxlength": "24:00:00",
		"scheduled_playlist_maxlength": "04:00:00"
	};
	
	/**	FETCH MODULE*/
	this.playlists  = []; // this is the scheduled playlists....in a range between now and max_playlist_duration
	
	/** LOGIC MODULE*/
	this.scheduled_clips = []; //here we must have the current playlist up to date...	
	this.cursor_scheduled_clip = -1;
	
	
	/** SYNC MODULE */
	this.actual_server_playlist = [];
	this.cursor_playing_clip = -1;
	this.cursor_next_clip = -1;
	
	/** PLAY MODULE */
	this.timer = null;
	this.actual_playing_clip = null;
	
	/** ALL MODULES */
    this.server     = new mvcp_server("melted");
    this.driver     = new playlists_driver("json");  
	 
    if (!this.configFile)
        this.configFile = './config.json';
   	
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    		
    this.config = require(this.configFile);	
	
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer(function() {
        

		self.play();

		self.startWatching();
        self.initDriver();
		
    });
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
var mosto_server = new mosto();
