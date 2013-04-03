var fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 	
	playlists_driver = require('./drivers/playlists/playlists-driver');
    
function ScheduledClip( media, schedule_time, expected_start, expected_end ) {
    this.media   = media;
	this.schedule_time = schedule_time;
	this.expected_start = expected_start;
	this.expected_end = expected_end;
};
	
function mosto(configFile) {
    var self = this;
       	   
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
		
		
		//now we update re-convert our Scheduled Clips
		self.convertPlaylistsToScheduledClips();
	}
		
		
	mosto.prototype.convertFramesToSeconds = function ( frames, fps ) {
		return frames/fps;
	}
	
	mosto.prototype.convertFramesToMiliseconds = function ( frames, fps ) {
		return frames*1000.0 / fps;
	}	
	
	mosto.prototype.convertUnixToDate =  function ( unix_timestamp ) {
		var date = new Date(unix_timestamp*1000);	
		return date.getHours()+":"+ date.getMinutes() + ":" date.getSeconds();
	}

	mosto.prototype.convertDateToUnix =  function ( date_timestamp ) {
	
		var date = new Date(date_timtestamp);
		return date.getTime()/1000;
	
	}
				
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
	* STATE MACHINE: for every same combinations of playlists we must have the same current playlist
	*/
	mosto.prototype.convertPlaylistsToScheduledClips = function() {
	
		console.log("mbs-mosto: converting Playlists to scheduled clips");
		
		//clean scheduled clips
		self.scheduled_clips = {};		
		var result = self.preparePlaylist( 0, 0 /**/ );
		
		self.syncroScheduledClips();
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
			console.log("Error in preparePlaylist: " + );
		}
		
		if ( self.convertDateToUnix( pl.startDate ) > endTimeCode ) {
			if ( pl.mode == "snap") {
				// just add all clips with schedule: "now"
				for( i=0; i<pl.length; i++) {
					schedule_time = "now";
					self.scheduled_clips.push( new ScheduledMedia( pl[i], schedule_time, "","" ) );
				}	
			} else if ( pl.mode == "fixed") {
				// just add all clips 
				i = 0;
				schedule_time = pl.startDate;
				self.scheduled_clips.push( new ScheduledMedia( pl[i], schedule_time, "","" ) );
				for( i=1; i<pl.length; i++) {
					schedule_time = "now";
					self.scheduled_clips.push( new ScheduledMedia( pl[i], schedule_time, "","" ) );
				}
			}
		}
		
		next_playlist_id++;		
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
	mosto.prototype.syncroScheduledClips = function() {
	
		var server_playing_list = self.server.getServerPlaylist();
		
		var i = 0;
		
		for(i=0; i<server_playing_list.length;i++) {
			//
		}
	
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
    
    		
    this.configFile = configFile;
    this.config     = false;    
  	this.playlists  = []; // this is the scheduled playlists....in a range between now and max_playlist_duration
	this.scheduled_clips = []; //here we must have the current playlist up to date...	
	this.actual_server_playlist = [];
	
    this.server     = new mvcp_server("melted");
    this.driver     = new playlists_driver("json");
  
	//scheduled clip: 	
	this.cursor_scheduled_clip = "";
	
  
    if (!this.configFile)
        this.configFile = './config.json';
   	
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);    
	this.default_config = {
		fps: "25", /* 25 | 30 | 50 | 60 */
		resolution: "hd", /* sd | hd | fullhd */		
		playout_mode: "direct" /* */		
	};
	
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer(function() {
        self.startWatching();
        self.initDriver();
    });
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
var mosto_server = new mosto();