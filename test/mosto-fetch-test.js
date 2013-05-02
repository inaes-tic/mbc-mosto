var assert = require("assert"),
    moment           = require('moment'),
    events   = require ('events'),
    util     = require ('util'),
    exec   = require('child_process').exec,
    mvcp_server      = require('../drivers/mvcp/mvcp-driver'),
    test_driver    = require('../drivers/playlists/test-driver'),
    mosto  = require('../mosto'),
    melted  = require('../api/Melted'),
    Playlist  = require('../api/Playlist'),
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

describe('Mosto [FETCH/Database] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    this.timeout(15000);
    
    melted.take(function() {

	    before(function(done) {
		    melted.stop(function(pid){
		        done();
		    });
	    });

	    describe('#[FETCH] start mosto', function() {
		    it('-- starting mosto shouldnt throw error', function() {
		        mosto_server = silence(function(){ return new mosto(); });
                mosto_server.driver = new test_driver();
		        assert.notEqual(mosto_server, undefined);
		    });
		    it('-- mvcp server connected should return false', function() {
		        var r = silence(function(){ return mosto_server.server_started; });
		        assert.equal(r, false);
		    });
	    });


        describe("#[FETCH] Checking no playlists", function() {
            it("--should return black_id", function(done) {
                assert.equal( mosto_server.playlists.length, 0 );
                assert.equal( mosto_server.scheduled_clips.length, 0 );
                done();
            });
        });


        describe("#[FETCH] Adding playlist", function() {

            var playlist = undefined;

            before(function(done){
                playlist =  mosto_server.driver.TestPlaylist();
                mosto_server.addPlaylist( playlist );
                done();
            });
            it("--should return same playlist ", function(done) {
                var result = true;
                assert.equal( mosto_server.playlists.length, 1 );
                assert.equal( mosto_server.playlists[0].id, playlist.id );
                assert.equal( mosto_server.playlists[0].name, playlist.name );
                assert.equal( mosto_server.playlists[0].startDate, playlist.startDate );
                assert.equal( mosto_server.playlists[0].medias.length, playlist.medias.length );
                assert.equal( mosto_server.playlists[0].endDate, playlist.endDate );
                assert.equal( mosto_server.playlists[0].mode, playlist.mode );
                assert.notEqual( mosto_server.scheduled_clips.length, 0 );
                done();
            });

        });

        describe("#[FETCH] Updating playlist", function() {

            var playlist = undefined;

            before(function(done){
                playlist =  mosto_server.driver.TestPlaylist();
                mosto_server.updatePlaylist( playlist );
                done();
            });
            it("--should return the same playlist updated", function(done) {
                assert.equal( mosto_server.playlists.length, 1 );
                assert.equal( mosto_server.playlists[0].id, playlist.id );
                assert.equal( mosto_server.playlists[0].name, playlist.name );
                assert.equal( mosto_server.playlists[0].startDate, playlist.startDate );
                assert.equal( mosto_server.playlists[0].medias.length, playlist.medias.length );
                assert.equal( mosto_server.playlists[0].endDate, playlist.endDate );
                assert.equal( mosto_server.playlists[0].mode, playlist.mode );
                assert.notEqual( mosto_server.scheduled_clips.length, 0 );
                done();
            });               
        });

        describe("#[FETCH] Remove playlist", function() {
            before(function(done){
                mosto_server.removePlaylist( "test_playlist_1_id" );
                done();
            });
            it("--should return only the blank black_id", function(done) {
                assert.equal( mosto_server.playlists.length, 1 );
                assert.equal( mosto_server.playlists[0].id, "black_id" );
                //assert.notEqual( mosto_server.scheduled_clips.length, 0 );
                done();
            });           
            
        });

        describe("#[FETCH] Doing a checkoutPlaylists()", function() {
            var driver_playlists = undefined;

            before(function(done){
                mosto_server.driver.setCheckoutMode(true);
                mosto_server.checkoutPlaylists( function(playlists) {
                    driver_playlists = playlists;
                    if (playlists.length==0) return done(new Error("test_driver->getPlaylists must return some playlists when called in co_mode:true"));
                    done();
                }); 
            });
            it("--should return the same playlist", function(done) {
                assert.equal( mosto_server.playlists.length, 1 );
                assert.notEqual( mosto_server.playlists[0].id, "black_id" );
                assert.equal( mosto_server.playlists[0].id, driver_playlists[0].id );
                assert.equal( mosto_server.playlists[0].name, driver_playlists[0].name );
                //assert.equal( mosto_server.playlists[0].startDate, driver_playlists[0].startDate );
                assert.equal( mosto_server.playlists[0].medias.length, driver_playlists[0].medias.length );
                //assert.equal( mosto_server.playlists[0].endDate, driver_playlists[0].endDate );
                assert.equal( mosto_server.playlists[0].mode, driver_playlists[0].mode );
                done();
            });           

        });

	    describe('#[FETCH] leave melted', function() {
		    it('-- leave melted', function(done) {
			    //mosto_server.stop();
			    mosto_server = null;
			    melted.stop(function(pid) {
				    melted.leave();
				    done();
			    });
		    });
	    });

    });    
    describe('#last [FETCH] check ', function() {
        it("--should finish FETCH", function(done) {
            done(); 
        });
    });

});
