var fs               = require('fs'),
    util             = require('util'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Media            = require('./api/Media'),
    ScheduledMedia   = require('./api/ScheduledMedia'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'),
    playlists_driver = require('./drivers/playlists/playlists-driver'),
    status_driver    = require('./drivers/status/pubsub'),
    utils            = require('./utils');

function mosto(configFile) {
    var self = this;
    
    mosto.prototype.addPlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Adding playlist " + playlist.name);
        self.playlists.push(playlist);
        console.log("mbc-mosto: [INFO] Added playlist:\nid: " + playlist.id
                    + "\nname: " + playlist.name
                    + "\nstartDate: " + playlist.startDate
                    + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.updatePlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Updating playlist " + playlist.name);
        var i = -1;
        self.playlists.some(function(element, index, array) {
            if (element.id === playlist.id) {
                i = index;
                return true;
            }
        });
        
        //update may create if needed
        //TODO: chech time window: startDate-endDate
        if (i==-1) {
            self.playlists.push(playlist);
        } else {
            //TODO: compare startDate and endDate with time window: if not in range, removePlaylist.
            self.playlists[i] = playlist;
        }

        console.log("mbc-mosto: [INFO] Updated playlist:\nid: " + playlist.id
                    + "\nname: " + playlist.name
                    + "\nstartDate: " + playlist.startDate
                    + "\nendDate: " + playlist.endDate);
        
        self.orderPlaylists();
    };
    
    mosto.prototype.removePlaylist = function(name) {
        console.log("mbc-mosto: [INFO] Removing playlist " + name);
        var i = -1;
        var playlist = undefined;
        self.playlists.some(function(element, index, array) {
            if (element.id === id) {
                i = index;
                playlist = element;
                return true;
            }
        });
        self.playlists.splice(i, 1);
        console.log("mbc-mosto: [INFO] Removed playlist:\nid: " + playlist.id
                    + "\nname: " + playlist.name
                    + "\nstartDate: " + playlist.startDate
                    + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
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
        self.playlists_updated = true;
        self.convertPlaylistsToScheduledClips();
    };
    
    /**     checkoutPlaylists       
     *       checkout load next playlists if needed
     *       each call to checkoutPlaylists advance the time_window
     *
     *       We are using a minimum memory overhead approach to store the playlists
     *       Full playlist has a maximum of 4 hours total length starting from "now"
     *       Any older playlist are removed from memory to release memory    
     */      
    mosto.prototype.checkoutPlaylists = function() {
        console.log("mbc-mosto: checking out new playlists");   
        
        //TODO: We need here to retreive data form DB Driver... (ask for it)
        // we retreive data when: we load for the first time...         

		self.time_window_from = moment();
		//var last_time_window_to = self.time_window_to.clone();
		var last_time_window_to = self.time_window_from.clone();

		self.time_window_to = self.time_window_from.clone();
		self.time_window_to.add( moment.duration({ hours: 4 }) );

		console.log("mbc-mosto: [INFO] [FETCH] checkoutPlaylists > from: " + self.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to:" + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

		//now we read playlists, between "last_time_window_to" and "time_window_to"
        self.driver.getPlaylists( { from: last_time_window_to, to: self.time_window_to, setWindow: false }, function(playlists) { 
			
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
			//orderPaylists
            if (self.playlists.length==0) {
              var sch_rightnow = moment(self.timer_clock).add( moment.duration({ milliseconds: 1000 }) ).format("DD/MM/YYYY HH:mm:ss.SSS");
              self.startBlack( sch_rightnow, "00:00:00.500", sch_rightnow, moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 500 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
            }
            self.orderPlaylists();

			//update the boundaries
			self.driver.setWindow( self.time_window_from, self.time_window_to );
		} );

        //TODO: If we are up to date, just return!! (important to avoid infinite recursions)        
        
    }        

    mosto.prototype.startBlack = function( schedule_time, sch_duration, sch_expect_start, sch_expect_end ) {
         var BlackMedia = new Media( 'black_id' /*id*/, '0' /*orig_order*/, '0'/*actual_order*/, '0' /*playlist_id*/, 'black' /*name*/, 'file' /*type*/, self.config.black, sch_duration/*length*/, ''/*fps*/ );
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
        
        //Check if we need to make a checkout! (upstream syncro!! > sync_lock must be true )
		//UPSTREAM 
		if ( self.sync_lock==true ) {
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
            return  self.checkoutPlaylists();
          }
        }

        //clean scheduled clips
        if (self.playlists_updated) {
	        self.scheduled_clips = [];              
			if (self.playlists.length>0) {
	    	    self.preparePlaylist( 0, -1 );
			}
			self.playlists_updated = false;
    	}
    
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
					if ( (i==0 && Math.abs(diff)<10000 && next_playlist_id>0 ) // firt clip of queued playlists if diff <  10 seconds are queued
                         ||
                         ( i>0 && Math.abs(diff)<10000)  ) //clips >0 => all queued clips after first one
                    {
                        schedule_time = "now";
					} else if ( 
                          (next_playlist_id==0 && i==0) // first playlist we have always need a schedule time
                          ||
                          (Math.abs(diff)>10000) ) // if diff > 10 seconds > use schedule time... (maybe a warning)
                    {						
                        //check if we have unclosed playlists (without black end clip) before this new one... 
                        if (next_playlist_id>0) {
                           self.queueBlack( "now", "00:00:00.500", lastTimeCode, moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 500 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
                        } else if (next_playlist_id==0) {
                           //if this is the first and only playlist, check if an empty void is left before it...., so we can put our blackmedia...
                           var sch_time_mom = moment(sch_time, "DD/MM/YYYY HH:mm:ss.SSS");
                           var sch_rightnow = moment(self.timer_clock).add( moment.duration({ milliseconds: 2000 }) ).format("DD/MM/YYYY HH:mm:ss.SSS");
                           var diff_void_start = sch_time_mom.diff( self.timer_clock );
                           console.log("mbc-mosto: [INFO] [LOGIC] preparePlaylist > empty space ? diff_void_start :" + diff_void_start );

                           if (diff_void_start>4000) {
                                self.queueBlack( sch_rightnow , "00:00:00.500", sch_rightnow, moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 2000 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
                           }

                        }

						schedule_time = sch_time;
					}

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
                //queue blackness to the end of the last playlist (no after a black media!)
                self.queueBlack( "now", "00:00:00.500", lastTimeCode, moment( lastTimeCode,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 500 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
            }
            return;
        }

        return self.preparePlaylist( next_playlist_id, lastTimeCode );
    }
    
    mosto.prototype.sendStatus = function() {
        //TODO: Fabricio should replace all invocations to this function with
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
                var i;
				for(i = 0; i< self.playlists.length; i++) {
                    playlist = self.playlists[i];
                    if (playlist.id===currentPlaylistId) {
		               break;
                    }
                }
                var index = i;
		        if (index > 0)
		            prevPlaylistId = self.playlists[index - 1].id;
		        if (0<=index && index < (self.playlists.length - 1))
		            nextPlaylistId = self.playlists[index + 1].id;
			}
/*
			if (self.playlists!==undefined && self.playlists.length>0) {
		        var playlist = _.find(self.playlists, function(pplaylist) {
		            if (pplaylist!==undefined && currentPlaylistId!==undefined) 
		               return pplaylist.id === currentPlaylistId;
		            else
		               return false;
		        });
		        var index = _.indexOf(self.playlists, playlist, true);

		        if (index > 0)
		            prevPlaylistId = self.playlists[index - 1].id;
		        if (index < (self.playlists.length - 1))
		            nextPlaylistId = self.playlists[index + 1].id;

			}
*/
        }

        currentClip = serverStatus.actualClip;
		if (serverPlaylist!==undefined && serverPlaylist.length>0) {
                var i;
				for(i = 0; i< serverPlaylist.length; i++) {
                    var prevxClip = serverPlaylist[i];
                    if (parseInt(prevxClip.order) === (parseInt(currentClip.order) - 1)) {
                       prevClip = prevxClip;
                       break;
                    }
                }

				for(i = 0; i< serverPlaylist.length; i++) {
                    var nextxClip = serverPlaylist[i];
                    if (parseInt(nextxClip.order) === (parseInt(currentClip.order) + 1)) {
                       nextClip = nextxClip;
                       break;
                    }
                }
		}
/*
		    if (parseInt(currentClip.order) > 0) {
		        prevClip = _.find(serverPlaylist, function(prevClip) {
		            return parseInt(prevClip.order) === (parseInt(currentClip.order) - 1);
		        });
		    }
		    if (parseInt(currentClip.order) < (serverPlaylist.length - 1)) {
		        nextClip = _.find(serverPlaylist, function(nextClip) {
		            return parseInt(nextClip.order) === (parseInt(currentClip.order) + 1);
		        });
		    }
*/
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
            "mbc-mosto: [INFO] MVCP server started";
            if (callback !== undefined) {
                self.server_started = true;
                callback();
            }
        }, function(err) {
            var e = new Error("mbc-mosto: [ERROR] Error starting MVCP server: " + err + ".\nRetrying in 5 seconds...");
            console.error(e);
            setTimeout(function() {
                self.startMvcpServer(self.playPlaylists);
            }, 5000);
        });
    };
    
    this.configFile     = configFile;
    this.config         = false;
    this.playlists      = [];
    this.server_started = false;
    
    if (!this.configFile)
        this.configFile = './config.json';
    
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);

    this.server     = new mvcp_server(this.config.mvcp_server);
    this.driver     = new playlists_driver(this.config.playlist_server);
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer(self.playPlaylists);
    self.startWatching();
    self.initDriver();
    setInterval(function() {
        self.sendStatus();
    }, 1000);
    
}

exports = module.exports = function(configFile) {
    util.inherits(mosto, events.EventEmitter);
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
