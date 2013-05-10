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
/*
// SILENCE LOG OUTPUT
var util = require('util');
var fs = require('fs');
var log = fs.createWriteStream('./stdout.log');

console.log = console.info = function(t) {
  var out;
  if (t && ~t.indexOf('%')) {
    out = util.format.apply(util, arguments);
    process.stdout.write(out + '\n');
    return;
  } else {
    out = Array.prototype.join.call(arguments, ' ');
  }
  out && log.write(out + '\n');
};
// END SILENCE LOG OUTPUT
*/

silence = function(callback) {
	var ori_console_log = console.log;
	var ori_console_error = console.error;
	console.log = function() { };
	console.error = function() { };
	var r = callback();
	console.log = ori_console_log;
	console.error = ori_console_error;
	return r;
}

describe('Mosto [PLAY/Timer event] tests', function(done) {

    var mosto_server = undefined;

    this.timeout(15000);

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


    
    describe("#[PLAY] Checking no playlists, play blank.", function() {
        before(function(done){
            mosto_server.driver.setCheckoutMode(false);
            mosto_server.fetcher.checkoutPlaylists( function(playlists) {
                if (playlists.length>0) done(new Error("test_driver->getPlaylists must return no playlists when called for first time"));
                done();
            });                
        });
        it("--should return black_id playing!!", function(done) {
            function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                });
            }

            is_playing_media( "black_id", 4, 500 );

        });
    });


    describe("#[PLAY] Adding playlist", function() {

        var playlist = null;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();            
            done();
        });
        it("--should be playing first clip of added playlist", function(done) {                
            function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.player.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( function() { is_playing_media( clipid, intents-1 ) }, interv);            
                });
            }

            mosto_server.scheduler.once('converted', function(mess1) {
                assert.equal( mosto_server.fetcher.playlists.length, 1 );
                mosto_server.synchronizer.once('synced', function(mess2) {                        
                    is_playing_media( playlist.medias[0].id, 4, 500 );
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
            function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.player.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( function() { is_playing_media( clipid, intents-1 ) }, interv);            
                });
            }
            mosto_server.scheduler.once('converted', function(mess1) {
                assert.equal( mosto_server.fetcher.playlists.length, 1 );
                mosto_server.synchronizer.once('synced', function(mess2) {
                    is_playing_media( playlist.medias[0].id, 4, 500 );
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
            function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.player.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( function() { is_playing_media( clipid, intents-1 )}, interv);
                });
            }
            mosto_server.fetcher.once('fetch_downstream', function( fplaylists ) {
                assert.equal( fplaylists.length, 1 );
                is_playing_media( "black_id", 16, 500 );
            });
            mosto_server.fetcher.removePlaylist( "test_playlist_1_id" );
        });           
        
    });

/*
    describe("#[PLAY] Doing a checkoutPlaylists()", function() {
        var driver_playlists = undefined;

        before(function(done){           
            mosto_server.driver.setCheckoutMode(true);
            mosto_server.fetcher.checkoutPlaylists( function(playlists) {
                driver_playlists = playlists;
                if (driver_playlists.length>0) {
                    done();
                } else {
                    done(new Error("mosto-play-test.js: error checkoutPlaylists returning no playlists"));
                }
            } );
        });
        it("--should play the same playlist", function() {

            function is_playing_media( clipid, intents, interv ) {
                if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.player.actual_playing_clip ));
                mosto_server.player.once('playing', function(mess3) {
                    console.log(mess3);
                    if ( mosto_server.player.actual_playing_clip == clipid ) {
                        done();
                    } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                });
            }

            mosto_server.scheduler.once('converted', function(mess1) {
                assert.equal( mosto_server.fetcher.playlists.length, 1 );
                mosto_server.synchronizer.once('synced', function(mess2) {
                    is_playing_media( driver_playlists[0].medias[0].id, 4, 500 );
                });
            });
            mosto_server.fetcher.checkoutPlaylists();
        });           

    });
*/

    describe('#[PLAY] Stop mosto and leave', function() {        
        before(function(done) {
		    mosto_server.finish(function() {
			    //melted.leave();
                done();                
            });        
        });
	    it('-- leave mosto and melted', function(done) {
            assert.equal( mosto_server.player.timer, undefined );
            done();
	    });
    });
    
    describe('#last [PLAY] check ', function() {
        it("--should finish PLAY", function(done) {
            done(); 
        });
    });

});
