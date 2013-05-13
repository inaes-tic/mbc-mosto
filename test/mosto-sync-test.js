var assert = require("assert"),
    moment           = require('moment'),
    events   = require ('events'),
    util     = require ('util'),
    exec   = require('child_process').exec,
    mvcp_server      = require('../drivers/mvcp/mvcp-driver'),
    mosto  = require('../mosto'),
    melted  = require('../api/Melted'),
    Playlist  = require('../api/Playlist'),
    status_driver    = require('../drivers/status/pubsub'),
    test_driver    = require('../drivers/playlists/test-driver'),
    Media  = require('../api/Media'),
    ScheduledMedia  = require('../api/ScheduledMedia'),
    mosto_fetcher    = require('../fetch'),
    mosto_scheduler  = require('../scheduler'),
    mosto_synchronizer  = require('../sync'),
    mosto_player  = require('../play');

describe('Mosto [SYNC/video server synchronizer] tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    var player = undefined;
    var scheduler = undefined;
    var synchronizer = undefined;
    var fetcher = undefined;

    //this.timeout(30000);

    before(function(done) {
        melted.take(function() {
		    melted.stop(function(){
    	        done();
    	    });
	    });
    });

    describe('#[SYNC] Start Melted', function() {
        it("--should not throw error", function(done) {
            melted.start(function(pid){
                if (pid) {
                    assert.notEqual( pid, 0);
                    done();
                } else done(new Error("no process id for melted! Start failed."));
            });
        });
    });

    describe('#[SYNC] Setup Melted', function() {
        it("--should not throw error", function(done) {
            melted.setup(undefined, undefined, function(has_err) {                        
                if (has_err) {
                    done(new Error(has_err));
                } else done();
            });            
        });
    });

    describe('#[SYNC] start mosto', function() {
	    before(function(done) {
	
            mosto_server = silence(function(){ return new mosto(); });

	        server = mosto_server.server = silence(function(){ return mvcp_server("melted"); });
            mosto_server.status_driver = silence(function(){ new status_driver(); });
            mosto_server.driver = new test_driver();

            fetcher = mosto_server.fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            scheduler = mosto_server.scheduler      = new mosto_scheduler( { mosto: mosto_server });
            synchronizer = mosto_server.synchronizer   = new mosto_synchronizer( { mosto: mosto_server });
            player = mosto_server.player         = new mosto_player( { mosto: mosto_server } );

            fetcher.init();
            scheduler.init(scheduler);
            synchronizer.init();
            player.init();	     
            done();
	    });
	    it('-- mvcp server connected should return false', function() {
            assert.notEqual( mosto_server, undefined);
	        assert.notEqual( mosto_server.server, undefined);
            assert.notEqual( mosto_server.driver, undefined);
	        assert.equal( mosto_server.server_started, false);
	    });
    });

    describe("#[SYNC] Initializing mosto video server", function() {
        before(function(done) {
            mosto_server.startMvcpServer( function() {
                done();                    
            });
	    });
        it("--should server has started", function() {
            assert.equal( mosto_server.server.isConnected(), true );
        });

    });

    describe("#[SYNC] Initializing mosto driver then play.", function() {
        before(function(done) {
            mosto_server.initDriver();
            mosto_server.player.play( mosto_server.player );
            done();
	    });
        it("--should timer have been created", function(done) {

            assert.notEqual( mosto_server.player.timer, undefined );
            assert.notEqual( mosto_server.player.timer, null );

            mosto_server.player.once('playing', function(mess) {
                done();
            });
        });
    });

    describe("#[SYNC] Checking no playlists, play blank.", function() {

        var my_playlists = undefined;
        var sched_clips = [];

        before(function(done){
            mosto_server.driver.setCheckoutMode(false);
            mosto_server.fetcher.checkoutPlaylists( function(playlists) {
                if (playlists.length>0) done(new Error("test_driver->getPlaylists must return no playlists when called for first time"));
                done();
            });
        });
        it("--should return black_id playing!!", function(done) {
            synchronizer.once('datareceived', function() {
                synchronizer.once('sync_downstream', function() {
                    server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id == "black_id")
                                done();
                            else done(new Error( server_status.actualClip.id+"!=black_id"));
                        },function(error) { done(new Error(error)); });
                   },function(error) { done(new Error(error)); });
                });
                synchronizer.emit('upstreamcheck');
            });
            synchronizer.emit('datasend',sched_clips);
            
        });
    });


    describe("#[SYNC] Adding playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();                
            done();
        });
        it("--should expect first clip playing in our playlist", function(done) {
            synchronizer.once('datareceived', function() {
                synchronizer.once('sync_downstream', function() {
                    server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id ==  playlist.medias[0].id ) {
                                done();
                            } else done(new Error( server_status.actualClip.id+"!=" + playlist.medias[0].id));
                        },function(error) { done(new Error(error)); });
                    },function(error) { done(new Error(error)); });
                });
            });
            fetcher.addPlaylist( playlist );
        });

        it("--should be playing the first clip from our playlist ", function(done) {
            done();
        });      
    });



    describe("#[SYNC] Updating playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();            
            done();
        });
        it("--should return the same playlist updated", function(done) {
            synchronizer.once('datareceived', function() {
                synchronizer.once('sync_downstream', function() {
                    server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id ==  playlist.medias[0].id ) {
                                done();
                            } else done(new Error( server_status.actualClip.id+"!=" + playlist.medias[0].id));
                        },function(error) { done(new Error(error)); });
                    },function(error) { done(new Error(error)); });
                });
            });            
            fetcher.updatePlaylist( playlist );
        });               
    });

    describe("#[SYNC] Remove playlist", function() {
        before(function(done){
            assert.notEqual( fetcher.playlists.length, 0 );
            assert.equal( fetcher.playlists[0].id, "test_playlist_1_id" );
            done();
        });
        it("--should return only the blank black_id", function(done) {
            synchronizer.once('datareceived', function() {
                synchronizer.once('sync_downstream', function() {
                    server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id == "black_id")
                                done();
                            else done(new Error( server_status.actualClip.id+"!=black_id"));
                        },function(error) { done(new Error(error)); });
                   },function(error) { done(new Error(error)); });
                });
            });
            fetcher.removePlaylist( "test_playlist_1_id" );
        });           
        
    });

    describe("#[SYNC] Doing a checkoutPlaylists()", function() {

        var driver_playlists = undefined;

        before(function(done){
            mosto_server.driver.setCheckoutMode(true);
            fetcher.checkoutPlaylists( function(playlists) {
                driver_playlists = playlists;
                if (playlists.length==0) return done(new Error("test_driver->getPlaylists must return some playlists when called in co_mode:true"));                    
                done();
            });
        });
        it("--should return the same playlist", function(done) {
            synchronizer.once('datareceived', function() {
                synchronizer.once('sync_downstream', function() {
                    server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id ==  driver_playlists[0].medias[0].id ) {
                                done();
                            } else done(new Error( server_status.actualClip.id+"!=" + driver_playlists[0].medias[0].id));
                        },function(error) { done(new Error(error)); });
                    },function(error) { done(new Error(error)); });
                });
            });            
            mosto_server.driver.setCheckoutMode(true);
            fetcher.checkoutPlaylists( function(playlists) {});
        });           

    });

    describe('#[SYNC] leave melted', function() {
	    it('-- leave melted', function(done) {
            mosto_server.player.stop();
            melted.stop( function(pid) {
			    melted.leave();
                done();                
            });		   
	    });
    });
   
    describe('#last [SYNC] check ', function() {
        it("--should finish SYNC", function(done) {
            done(); 
        });
    });

});
