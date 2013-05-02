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
    Media  = require('../api/Media');

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

describe('Mosto [SYNC/video server synchronizer] tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    this.timeout(30000);

    melted.take(function() {
	    before(function(done) {
		    melted.stop(function(pid){
		        done();
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
		    it('-- starting mosto shouldnt throw error', function(done) {
		        mosto_server = silence(function(){ return new mosto(); });
		        mosto_server.server = silence(function(){ return mvcp_server("melted"); });
                mosto_server.status_driver = new status_driver();
                mosto_server.driver = new test_driver();
                mosto_server.driver.start();
		        assert.notEqual(mosto_server, undefined);
                done();
		    });
		    it('-- mvcp server connected should return false', function(done) {
		        assert.notEqual( mosto_server.server, undefined);
                assert.notEqual( mosto_server.driver, undefined);
		        assert.equal(mosto_server.server_started, false);
                done();
		    });
	    });

        describe("#[SYNC] Initializing mosto video server", function() {
            before(function(done) {
                done();
		    });
            it("--should server has started", function(done) {
                mosto_server.startMvcpServer( function() {
                    assert.equal( mosto_server.server.isConnected(), true );
                    done();                    
                });
            });

        });

        describe("#[SYNC] Initializing mosto driver then play.", function() {
            before(function(done) {
                mosto_server.initDriver();
                mosto_server.play();               
                done();
		    });
            it("--should timer have been created", function(done) {
                mosto_server.once('playing', function(mess) {
                    assert.notEqual( mosto_server.timer, undefined );
                    assert.notEqual( mosto_server.timer, null );
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

                console.log( "scheduled_clips ("+mosto_server.scheduled_clips.length+")" );

                function is_expected_clip( clipid, intents, interv ) {      
                    var exp_clip = mosto_server.getExpectedClip();
                    if (intents==0) return done(new Error("max intents reached! expected clip: " + clipid+ " is  not " + exp_clip.media.id ));
                    mosto_server.once('converted', function(server_playlist) {
                        exp_clip = mosto_server.getExpectedClip();
                        if (exp_clip.media.id == clipid) {                                
                            done();
                        } else setTimeout( is_expected_clip( clipid, intents-1 ), interv);
                    });
                }

                is_expected_clip( playlist.medias[0].id, 3, 250 );
                
                mosto_server.addPlaylist( playlist );
            });

            it("--should be playing the first clip from our playlist ", function(done) {
               function is_playing_media( clipid, intents, interv ) {
                    if (intents==0) return done(new Error("max intents reached! We are not playing expected clip: " + clipid+ " is  not " + mosto_server.actual_playing_clip ));
                    mosto_server.once('playing', function(mess3) {
                        console.log(mess3);
                        if ( mosto_server.actual_playing_clip == clipid ) {
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
                mosto_server.updatePlaylist( playlist );
                done();
            });
            it("--should return the same playlist updated", function(done) {
                done();
            });               
        });

        describe("#[SYNC] Remove playlist", function() {
            before(function(done){
                mosto_server.removePlaylist( "test_playlist_1_id" );
                done();
            });
            it("--should return only the blank black_id", function(done) {
                assert.equal( mosto_server.playlists.length, 1 );
                assert.equal( mosto_server.playlists[0].id, "black_id" );
                done();
            });           
            
        });

        describe("#[SYNC] Doing a checkoutPlaylists()", function() {
            var driver_playlists = undefined;

            before(function(done){                                
                done();
            });
            it("--should return the same playlist", function(done) {
                mosto_server.once('converted', function(mess) {
                    assert.equal( mosto_server.playlists.length, 1 );
                    assert.notEqual( mosto_server.playlists[0].id, "black_id" );
                    if (driver_playlists) assert.equal( mosto_server.playlists[0].id, driver_playlists[0].id );
                    done();
                });
                mosto_server.driver.setCheckoutMode(true);
                mosto_server.checkoutPlaylists( function(playlists) {
                    driver_playlists = playlists;
                });
            });           

        });

	    describe('#[SYNC] leave melted', function() {
		    it('-- leave melted', function(done) {
			    mosto_server.stop();
			    mosto_server = null;
			    melted.stop(function(pid) {
				    melted.leave();
				    done();
			    });
		    });
	    });

    });

    describe('#last [SYNC] check ', function() {
        it("--should finish SYNC", function(done) {
            done(); 
        });
    });

});
