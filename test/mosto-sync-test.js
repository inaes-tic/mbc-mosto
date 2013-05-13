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
    mosto_fetcher    = require('../fetch'),
    mosto_scheduler  = require('../scheduler'),
    mosto_synchronizer  = require('../sync'),
    mosto_player  = require('../play');

describe('Mosto [SYNC/video server synchronizer] tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    this.timeout(30000);

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

	        mosto_server.server = silence(function(){ return mvcp_server("melted"); });
            mosto_server.status_driver = silence(function(){ new status_driver(); });
            mosto_server.driver = new test_driver();

            mosto_server.fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            mosto_server.scheduler      = new mosto_scheduler( { mosto: mosto_server });
            mosto_server.synchronizer   = new mosto_synchronizer( { mosto: mosto_server });
            mosto_server.player         = new mosto_player( { mosto: mosto_server } );

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
            mosto_server.player.play();
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


    describe("#[SYNC] Adding playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();                
            done();
        });
        it("--should expect first clip from our playlist", function(done) {

            console.log( "scheduled_clips ("+mosto_server.scheduler.scheduled_clips.length+")" );

            function is_expected_clip( clipid, intents, interv ) {      
                var exp_clip = mosto_server.synchronizer.getExpectedClip( mosto_server.scheduler.scheduled_clips );
                if (intents==0) return done(new Error("max intents reached! expected clip: " + clipid+ " is  not " + exp_clip.media.id ));
                mosto_server.scheduler.once('converted', function(server_playlist) {
                    exp_clip = mosto_server.synchronizer.getExpectedClip( mosto_server.scheduler.scheduled_clips );
                    if (exp_clip && exp_clip.media.id == clipid) {                                
                        done();
                    } else setTimeout( is_expected_clip( clipid, intents-1 ), interv);
                });
            }

            is_expected_clip( playlist.medias[0].id, 3, 250 );
            
            mosto_server.fetcher.addPlaylist( playlist );
        });

        it("--should be playing the first clip from our playlist ", function(done) {
           function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.player.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                });

            }

            setTimeout( function() { is_playing_media( playlist.medias[0].id, 3, 250 ); } , 1000 );                    
        });


    });


    describe("#[SYNC] Updating playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();
            mosto_server.fetcher.updatePlaylist( playlist );
            done();
        });
        it("--should return the same playlist updated", function(done) {
            done();
        });               
    });

    describe("#[SYNC] Remove playlist", function() {
        before(function(done){
            mosto_server.fetcher.removePlaylist( "test_playlist_1_id" );
            done();
        });
        it("--should return only the blank black_id", function(done) {
            done();
        });           
        
    });

    describe("#[SYNC] Doing a checkoutPlaylists()", function() {
        var driver_playlists = undefined;

        before(function(done){                                
            done();
        });
        it("--should return the same playlist", function(done) {
            mosto_server.scheduler.once('converted', function(mess) {
                assert.equal( mosto_server.fetcher.playlists.length, 1 );
                assert.notEqual( mosto_server.fetcher.playlists[0].id, "black_id" );
                if (driver_playlists) assert.equal( mosto_server.fetcher.playlists[0].id, driver_playlists[0].id );
                done();
            });
            mosto_server.driver.setCheckoutMode(true);
            mosto_server.fetcher.checkoutPlaylists( function(playlists) {
                driver_playlists = playlists;
            });
        });           

    });

    describe('#[SYNC] leave melted', function() {
	    it('-- leave melted', function(done) {
		    mosto_server.finish(function() {
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
