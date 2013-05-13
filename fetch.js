var fs               = require('fs'),
    util             = require('util'),
    events           = require('events'),
    moment           = require('moment'),
    Playlist         = require('./api/Playlist'),
    Melted           = require('./api/Melted'),
    Media            = require('./api/Media'),
    StreamerCom      = require('./api/StreamerCom');

function fetch( config ) {

    StreamerCom.call(this);

    this.mosto = config.mosto;
    this.driver = config.mosto.driver;
    this.name = "fetcher";

    this.scheduler = undefined;
    this.fetcher = undefined;
    this.player = undefined;

    this.playlists = []; // this is the scheduled playlists....in a range between now and max_playlist_duration
    this.time_window_from = "";
    this.time_window_to = "";
    this.playlists_updated = false;

}

fetch.prototype = new StreamerCom();

fetch.prototype.init = function() {
    var self = this;

    self.scheduler = self.mosto.scheduler;
    self.player = self.mosto.player;

    self.name = "fetcher";

    /*GOING DOWN: we listen to ourself and emit on Scheduler*/
    self.on( 'fetch_downstream', function(playlists) {
        console.log("mbc-mosto: [INFO] [FETCH] Auto received fetch_downstream: " + playlists.length + " scheduler:"+self.scheduler);
        if (self.scheduler) self.scheduler.emit('datasend', playlists );
    });

    /*COMING FROM BELOW: we listen to Scheduler*/
    if (self.scheduler) self.scheduler.on( 'fetch_upstream', function() {
        console.log("mbc-mosto: [INFO] [FETCH] timer unlock from fetch_upstream. Top of machine reached.");
        self.upstreamCheck(self);
    });

    //open data receiver
    //open data receiver
    if (self.Open( self ) && self.IsReceiving()) {
        console.log('mbc-mosto: [INFO] [FETCH] Opened');        
    } else throw new Error("mbc-mosto: [ERROR] [FETCH] couldn't open StreamerCom");

}

        self.driver = self.mosto.driver;

        self.scheduler = self.mosto.scheduler;
        if (self.scheduler) self.scheduler.on( 'fetch_upstream', function() {
            self.checkoutPlaylists( function() {
                console.log("mbc-mosto: [INFO] [FETCH] timer unlock from fetch_upstream. Top of machine reached.");
                self.player.timerUnlock();
            });
        });

        self.player = self.mosto.player;

    }

    /** FETCH MODULE */

    //TODO: testing json, then mongodb

    /** addPlaylist
     *
     *       add a new playlist
     */
    fetch.prototype.addPlaylist = function(playlist) {

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
    fetch.prototype.updatePlaylist = function(playlist) {

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
    fetch.prototype.removePlaylist = function(id) {

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
    fetch.prototype.orderPlaylists = function() {
    
        self.removeBlackPlaylist();        
        self.trimPlaylists();

        if (self.playlists.length==0) {

            var sch_rightnow = moment().add( moment.duration({ milliseconds: -1000 }) ).format("DD/MM/YYYY HH:mm:ss.SSS");            
            self.startBlack( sch_rightnow, "22:22:22.22", sch_rightnow, moment( sch_rightnow,"DD/MM/YYYY HH:mm:ss.SSS").add(moment.duration({ milliseconds: 80542220 }) ).format('DD/MM/YYYY HH:mm:ss.SSS') );
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

        //Here we must emit a "scheduler" event with actual self.playlists object...
        //if (self.scheduler) self.scheduler.convertPlaylistsToScheduledClips();
        self.emit('fetch_downstream', self.playlists );        

    };

    
    /** trimPlaylists
     *       remove any playlist that is out of our time window
     *
     *
     */
    fetch.prototype.trimPlaylists = function() {
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

    fetch.prototype.removeBlackPlaylist = function() {
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

    fetch.prototype.updateTimeWindow = function() {
        if (self.player) self.player.timer_clock = moment();
        if (self.player) self.player.sync_lock_start = moment();

        self.time_window_from = moment( moment().toDate());
        //var last_time_window_to = self.time_window_to.clone();
        //var last_time_window_to = self.time_window_from.clone();
        self.time_window_to = self.time_window_from.clone();
        self.time_window_to.add( moment.duration({ hours: 4 }) );

        if (self.driver)
            self.driver.setWindow( self.time_window_from, self.time_window_to );

    }

    /**     checkoutPlaylists
     *       checkout load next playlists if needed
     *       each call to checkoutPlaylists advance the time_window
     *
     *       We are using a minimum memory overhead approach to store the playlists
     *       Full playlist has a maximum of 4 hours total length starting from "now"
     *       Any older playlist are removed from memory to release memory
     */
    fetch.prototype.checkoutPlaylists = function(callback) {
        console.log("mbc-mosto: [INFO] [FETCH] checking out new playlists in our time window.");

        //TODO: just ask for the difference between "actual time window" and "last time window"
        var last_time_window_to = moment(self.time_window_to);

        self.updateTimeWindow();

        console.log("mbc-mosto: [INFO] [FETCH] checkoutPlaylists > from: " + self.time_window_from.format("DD/MM/YYYY HH:mm:ss") + " to:" + self.time_window_to.format("DD/MM/YYYY HH:mm:ss") );

        //now we read playlists, between "last_time_window_to" and "time_window_to"
        if (self.driver) {
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
        } else console.error("mbc-mosto: ERROR [FETCH] checkoutPlaylist > playlist driver is undefined! ");
    }

    fetch.prototype.startBlack = function( schedule_time, sch_duration, sch_expect_start, sch_expect_end ) {
        var BlackMedia = new Media( 'black_id' /*id*/, '0' /*orig_order*/, '0'/*actual_order*/, 'black_id' /*playlist_id*/, 'black' /*name*/, 'file' /*type*/, self.mosto.config.black, sch_duration/*length*/, ''/*fps*/ );
        console.log("mbc-mosto: [INFO] [LOGIC] startBlack > media:" + BlackMedia.file + " schedule_time:" + schedule_time + " sch_duration:" + sch_duration + " sch_expect_start:" + sch_expect_start + " sch_expect_end:" + sch_expect_end + " fps?:"+BlackMedia.fps );
        var medias = [];
        medias.push(BlackMedia);
        self.playlists.push( new Playlist( BlackMedia.id, BlackMedia.id, moment( sch_expect_start, "DD/MM/YYYY HH:mm:ss.SSS" ).toDate(), medias, moment( sch_expect_end, "DD/MM/YYYY HH:mm:ss.SSS" ).toDate(), "snap" ) );
    }


exports = module.exports = function(config) {
    var mosto_fetch = new fetch(config);
    mosto_fetch.ResetListeners();
    return mosto_fetch;
};
