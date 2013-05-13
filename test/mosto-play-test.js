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
    _                = require('underscore'),
    Media  = require('../api/Media'),
    mosto_fetcher    = require('../fetch'),
    mosto_scheduler  = require('../scheduler'),
    mosto_synchronizer  = require('../sync'),
    mosto_player  = require('../play');

describe('Mosto [PLAY/Timer event] tests', function(done) {

    var mosto_server = undefined;
    var server = undefined;
    var player = undefined;
    
    //this.timeout(15000);

    before(function(done) {
        melted.take(function() {
		    melted.stop(function(){
    	        done();
    	    });
	    });
    });

    describe('#[PLAY] Start Melted', function() {
        it("--should not throw error", function(done) {
            melted.start(function(pid){
                if (pid) {
                    assert.notEqual( pid, 0);
                    done();
                } else done(new Error("no process id for melted! Start failed."));
            });
        });
    });

    describe('#[PLAY] Setup Melted', function() {
        it("--should not throw error", function(done) {
            melted.setup(undefined, undefined, function(has_err) {                        
                if (has_err) {
                    done(new Error(has_err));
                } else done();
            });            
        });
    });

    describe('#[PLAY] start mosto', function() {
	    before(function(done) {
	
            mosto_server = silence(function(){ return new mosto(); });

	        server = mosto_server.server = silence(function(){ return mvcp_server("melted"); });
            mosto_server.status_driver = new status_driver();
            mosto_server.driver = new test_driver();

            mosto_server.fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            mosto_server.scheduler      = new mosto_scheduler( { mosto: mosto_server });
            mosto_server.synchronizer   = new mosto_synchronizer( { mosto: mosto_server });
            player = mosto_server.player         = new mosto_player( { mosto: mosto_server } );

            mosto_server.fetcher.init();
            mosto_server.scheduler.init();
            mosto_server.synchronizer.init();
            mosto_server.player.init();	     
            done();
	    });
	    it('-- mvcp server connected should return false', function() {
            assert.notEqual( mosto_server, undefined);
	        assert.notEqual( mosto_server.server, undefined);
            assert.notEqual( mosto_server.driver, undefined);
	        assert.equal( mosto_server.server_started, false);
	    });
    });

    describe("#[PLAY] Initializing mosto video server", function() {
        before(function(done) {
            mosto_server.startMvcpServer( function() {
                done();                    
            });
	    });
        it("--should server has started", function() {
            assert.equal( mosto_server.server.isConnected(), true );
        });

    });

    describe("#[PLAY] Initializing mosto driver then play.", function() {
        before(function(done) {
            mosto_server.initDriver();
            mosto_server.player.play( mosto_server.player );
            done();
	    });
        it("--should timer have been created", function(done) {
            mosto_server.player.once('playing', function(mess) {
                assert.notEqual( mosto_server.player.timer, undefined );
                assert.notEqual( mosto_server.player.timer, null );
                done();
            });
        });
    });


    describe("#[PLAY] Checking no playlists, play blank.", function() {
        before(function(done){
            mosto_server.driver.setCheckoutMode(false);
            mosto_server.fetcher.checkoutPlaylists( function(playlists) {
                if (playlists.length>0) done(new Error("test_driver->getPlaylists must return no playlists when called for first time"));
                done();
            });                
        });
        it("--should return black_id playing!!", function(done) {
            mosto_server.synchronizer.once('synced', function() {
                mosto_server.player.once('status', function(status) {
                    assert.equal( status.clip.current.id, 'black_id' );
                    done();
                });
            });
            mosto_server.fetcher.checkoutPlaylists( function(playlists) { } );
        });
    });


    describe("#[PLAY] Adding playlist", function() {

        var playlist = null;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();            
            done();
        });
        it("--should be playing first clip of added playlist", function(done) {
            mosto_server.synchronizer.once('synced', function(mess) {
                mosto_server.player.once('status', function(status) {
                    if ( status.status!='playing' ) {
                        done(new Error("status.status!=playing"));
                    } else if(status.clip.current.id!=playlist.medias[0].id) {
                        done(new Error("status.clip.current.id!=playlist.medias[0].id"));
                    } else {
                        done();
                    }
                });
            });
            mosto_server.fetcher.addPlaylist( playlist );
        });
    });

    describe("#[PLAY] Updating playlist", function() {

        var playlist = null;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();
            playlist.medias.splice( 2, 1 );                
            done();
        });
        it("--should return the same playlist updated", function(done) {
            mosto_server.synchronizer.once('synced', function() {
                mosto_server.player.once('status', function(status) {
                    assert.equal( status.status, 'playing');
                    assert.equal( status.clip.current.id, playlist.medias[0].id );
                    done();
                });
            });
            mosto_server.fetcher.updatePlaylist( playlist );
        });               
    });

    describe("#[PLAY] Remove playlist", function() {
        before(function(done){                
            done();
        });
        it("--should return only the blank black_id", function(done) {
            mosto_server.player.once('dataupdated', function( streamercom_name ) {
                mosto_server.player.once('play_endstream', function() {
                    mosto_server.player.once('status', function(status) {
                        assert.equal( status.clip.current.id, 'black_id' );
                        done();
                    });
                });
            });
            mosto_server.fetcher.removePlaylist( "test_playlist_1_id" );
        });                   
    });

    describe("#[PLAY] Doing a checkoutPlaylists()", function() {
        var driver_playlists = undefined;

        before(function(done){           
            mosto_server.driver.setCheckoutMode(true);
            mosto_server.driver.getPlaylists( { from: moment(), to: moment().add(moment.duration({milliseconds: 100000 })) }, function(playlists) {
                driver_playlists = playlists;
                if (driver_playlists.length>0) {
                    done();
                } else {
                    done(new Error("mosto-play-test.js: error checkoutPlaylists returning no playlists"));
                }
            } );
        });
        it("--should play the same playlist", function(done) {
            mosto_server.player.once('dataupdated', function() {
                mosto_server.player.once('play_endstream', function() {
                   server.getServerPlaylist( function( server_playlist ) {
                        server.getServerStatus( function( server_status ) {                    
                            if (server_status.actualClip.id == driver_playlists[0].medias[0].id/* && server_status.status=="playing"*/ )
                                done();
                            else done(new Error( server_status.actualClip.id+"!=" + driver_playlists[0].medias[0].id + " status:"+server_status.status ));
                        },function(error) { done(new Error(error)); });
                   },function(error) { done(new Error(error)); });
                });
            });
            mosto_server.fetcher.checkoutPlaylists();
        });
    });

    describe('#[PLAY] Stop mosto and leave', function() {        
        before(function(done) {
		    //mosto_server.finish(function() {
            mosto_server.stopDriver();
            mosto_server.player.stop();
            melted.stop( function(pid) {
                mosto_server = null;
			    melted.leave();
                done();                
            });
        });
	    it('-- leave mosto and melted', function(done) {
            //assert.equal( mosto_server.player.timer, undefined );
            done();
	    });
    });

    describe('#last [PLAY] check ', function() {
        it("--should finish PLAY", function(done) {
            done(); 
        });
    });

});
