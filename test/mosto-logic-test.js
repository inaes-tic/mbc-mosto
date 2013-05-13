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
    Media  = require('../api/Media'),
    mosto_fetcher  = require('../fetch'),
    mosto_scheduler  = require('../scheduler');

describe('Mosto [LOGIC/Scheduler] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;
    var scheduler = undefined;
    var fetcher = undefined;

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
            mosto_server.driver = new test_driver();

            fetcher = mosto_server.fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            scheduler = mosto_server.scheduler        = new mosto_scheduler( { mosto: mosto_server } );

            mosto_server.fetcher.init();
            mosto_server.scheduler.init();
	    });
	    it('-- mvcp server connected should return false', function() {
	        var r = silence(function(){ return mosto_server.server_started; });
	        assert.equal(r, false);
	    });
    });


    describe("#[LOGIC] Checking start with no playlists", function() {
        it("--should return no clips", function(done) {
            assert.equal( scheduler.scheduled_clips.length, 0 );
            done();
        });
    });


    describe("#[LOGIC] Adding playlist", function() {

        var playlist = undefined;

        before(function(done){
            mosto_server.driver.start();
            playlist = mosto_server.driver.TestPlaylist();
            done();
        });
        it("--should return same playlist ", function(done) {                
            mosto_server.scheduler.once('converted', function(mess) {
/*
                console.log("mosto-logic-test.js:         timer clock [ ]: " + mosto_server.timer_clock.format("DD/MM/YYYY HH:mm:ss.SSS") );
                console.log("mosto-logic-test.js: expected playlist start: " +  moment(mosto_server.playlists[0].startDate).format("DD/MM/YYYY HH:mm:ss.SSS") );
                console.log("mosto-logic-test.js: expected start clip [0]: " +  mosto_server.scheduled_clips[0].expected_start + " id:" + mosto_server.scheduled_clips[0].media.id );
                console.log("mosto-logic-test.js: expected start clip [1]: " +  mosto_server.scheduled_clips[1].expected_start + " id:" + mosto_server.scheduled_clips[1].media.id );
*/
                assert.equal( scheduler.scheduled_clips.length, 4 );
                assert.equal( scheduler.scheduled_clips[0].media.id, playlist.medias[0].id );
                assert.equal( scheduler.scheduled_clips[1].media.id, playlist.medias[1].id );
                assert.equal( scheduler.scheduled_clips[2].media.id, playlist.medias[2].id );
                assert.equal( scheduler.scheduled_clips[3].media.id, "black_id" );
                done();
            });
            fetcher.addPlaylist( playlist );
        });

    });

    describe("#[LOGIC] Updating playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();
            fetcher.updatePlaylist( playlist );
            done();
        });
        it("--should return the first clip of playlist", function(done) {
            assert.notEqual( scheduler.scheduled_clips.length, 0 );
            done();
        });               
    });

    describe("#[LOGIC] Remove playlist", function() {
        before(function(done){
            fetcher.removePlaylist( "test_playlist_1_id" );
            done();
        });
        it("--should return only the blank black_id", function(done) {
            assert.notEqual( scheduler.scheduled_clips.length, 0 );
            done();
        });           
        
    });

    describe("#[LOGIC] Doing a checkoutPlaylists()", function() {
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
            assert.notEqual( scheduler.scheduled_clips.length, 0 );
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
