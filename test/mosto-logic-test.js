var assert      = require("assert")
,   moment      = require('moment')
,   events      = require ('events')
,   util        = require ('util')
,   exec        = require('child_process').exec
,   mvcp_server = require('../drivers/mvcp/mvcp-driver')
,   test_driver = require('../drivers/playlists/test-driver')
,   mosto       = require('../mosto')
,   melted      = require('../api/Melted')
,   Playlist    = require('../api/Playlist')
,   Media       = require('../api/Media');


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

describe('Mosto [LOGIC/Scheduler] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    this.timeout(15000);

    before(function(done) {
        melted.take(function() {
            melted.stop(function(){
                done();
            });
        });
    });

    describe('#[LOGIC] start mosto', function() {
        it('-- starting mosto shouldnt throw error', function() {
            mosto_server = silence(function(){ return new mosto(); });
            assert.notEqual(mosto_server, undefined);
        });
        it('-- mvcp server connected should return false', function() {
            var r = silence(function(){ return mosto_server.server_started; });
            assert.equal(r, false);
        });
    });


    describe("#[LOGIC] Checking no playlists", function() {
        it("--should return black_id", function(done) {
            assert.equal( mosto_server.playlists.length, 0 );
            assert.equal( mosto_server.scheduled_clips.length, 0 );
            done();
        });
    });


    describe("#[LOGIC] Adding playlist", function() {

        var playlist = undefined;

        before(function(done){
            mosto_server.driver = new test_driver();
            mosto_server.driver.start();
            playlist = mosto_server.driver.TestPlaylist();
            done();
        });
        it("--should return same playlist ", function(done) {                
            mosto_server.once('converted', function(mess) {
                console.log("mosto-logic-test.js:         timer clock [ ]: " + mosto_server.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
                console.log("mosto-logic-test.js: expected playlist start: " +  moment(mosto_server.playlists[0].startDate).format("DD/MM/YYYY HH:mm:ss.SSS") );
                console.log("mosto-logic-test.js: expected start clip [0]: " +  mosto_server.scheduled_clips[0].expected_start + " id:" + mosto_server.scheduled_clips[0].media.id );
                console.log("mosto-logic-test.js: expected start clip [1]: " +  mosto_server.scheduled_clips[1].expected_start + " id:" + mosto_server.scheduled_clips[1].media.id );

                assert.equal( mosto_server.scheduled_clips.length, 4 );
                assert.equal( mosto_server.scheduled_clips[0].media.id, playlist.medias[0].id );
                assert.equal( mosto_server.scheduled_clips[1].media.id, playlist.medias[1].id );
                assert.equal( mosto_server.scheduled_clips[2].media.id, playlist.medias[2].id );
                assert.equal( mosto_server.scheduled_clips[3].media.id, "black_id" );
                done();
            });
            mosto_server.addPlaylist( playlist );
        });

    });

    describe("#[LOGIC] Updating playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();
            mosto_server.updatePlaylist( playlist );
            done();
        });
        it("--should return the same playlist updated", function(done) {
            var result = true;
            assert.equal( mosto_server.playlists.length, 1 );
            assert.equal( mosto_server.playlists[0].id, playlist.id );
            assert.equal( mosto_server.playlists[0].name, playlist.name );
            assert.equal( mosto_server.playlists[0].startDate, playlist.startDate );
            assert.equal( mosto_server.playlists[0].medias.length, playlist.medias.length );
            assert.equal( mosto_server.playlists[0].endDate, playlist.endDate );
            assert.equal( mosto_server.playlists[0].mode, playlist.mode );
            done();
        });               
    });

    describe("#[LOGIC] Remove playlist", function() {
        before(function(done){
            mosto_server.removePlaylist( "test_playlist_1_id" );
            done();
        });
        it("--should return only the blank black_id", function(done) {
            assert.equal( mosto_server.playlists.length, 1 );
            assert.equal( mosto_server.playlists[0].id, "black_id" );
            assert.notEqual( mosto_server.scheduled_clips.length, 0 );
            done();
        });           
        
    });

    describe("#[LOGIC] Doing a checkoutPlaylists()", function() {
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
            done();
        });           

    });

    describe('#[LOGIC] leave melted', function() {
        it('-- leave melted', function(done) {
            //mosto_server.stop();
            mosto_server = null;
            melted.stop(function(pid) {
                melted.leave();
                done();
            });
        });
    });

    describe('#last [LOGIC] check ', function() {
        it("--should finish LOGIC", function(done) {
            done(); 
        });
    });


});
