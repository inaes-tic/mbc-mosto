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
    mosto_fetcher  = require('../fetch');

describe('Mosto [FETCH/Database] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;
    var fetcher = undefined;

    this.timeout(15000);
    
    before(function(done) {
        melted.take(function() {
	        melted.stop(function(){
	            done();
	        });
        });
    });

    describe('#[FETCH] start mosto', function() {
	    it('-- starting mosto shouldnt throw error', function() {

	        mosto_server = silence(function(){ return new mosto(); });
            mosto_server.driver = new test_driver();

            fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            mosto_server.fetcher = fetcher;

            fetcher.init();

	        assert.notEqual(mosto_server, undefined);
	    });
	    it('-- mvcp server connected should return false', function() {
	        var r = silence(function(){ return mosto_server.server_started; });
	        assert.equal(r, false);
	    });
    });


    describe("#[FETCH] Checking no playlists", function() {
        it("--should return black_id", function(done) {
            assert.equal( fetcher.playlists.length, 0 );
            done();
        });
    });


    describe("#[FETCH] Adding playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist =  mosto_server.driver.TestPlaylist();
            done();
        });
        it("--should return same playlist ", function(done) {            
            fetcher.once( 'fetch_downstream', function(playlists) {
                assert.equal( playlists.length, 1 );
                assert.equal( playlists[0].id, playlist.id );
                assert.equal( playlists[0].name, playlist.name );
                assert.equal( playlists[0].startDate, playlist.startDate );
                assert.equal( playlists[0].medias.length, playlist.medias.length );
                assert.equal( playlists[0].endDate, playlist.endDate );
                assert.equal( playlists[0].mode, playlist.mode );
                done();
            });
            fetcher.addPlaylist( playlist );

        });

    });

    describe("#[FETCH] Updating playlist", function() {

        var playlist = undefined;

        before(function(done){
            playlist =  mosto_server.driver.TestPlaylist();            
            done();
        });
        it("--should return the same playlist updated", function(done) {
            fetcher.once( 'fetch_downstream', function(playlists) {
                assert.equal( playlists.length, 1 );
                assert.equal( playlists[0].id, playlist.id );
                assert.equal( playlists[0].name, playlist.name );
                assert.equal( playlists[0].startDate, playlist.startDate );
                assert.equal( playlists[0].medias.length, playlist.medias.length );
                assert.equal( playlists[0].endDate, playlist.endDate );
                assert.equal( playlists[0].mode, playlist.mode );
                done();
            });
            fetcher.updatePlaylist( playlist );
        });               
    });

    describe("#[FETCH] Remove playlist", function() {
        before(function(done){
            done();
        });
        it("--should return only the blank black_id", function(done) {
            fetcher.once( 'fetch_downstream', function(playlists) {
                assert.equal( playlists.length, 1 );
                assert.equal( playlists[0].id, "black_id" );
                done();
            });
            fetcher.removePlaylist( "test_playlist_1_id" );
        });           
        
    });

    describe("#[FETCH] Doing a checkoutPlaylists()", function() {
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
            assert.equal( fetcher.playlists.length, 1 );
            assert.notEqual( fetcher.playlists[0].id, "black_id" );
            assert.equal( fetcher.playlists[0].id, driver_playlists[0].id );
            assert.equal( fetcher.playlists[0].name, driver_playlists[0].name );
            //assert.equal( mosto_server.playlists[0].startDate, driver_playlists[0].startDate );
            assert.equal( fetcher.playlists[0].medias.length, driver_playlists[0].medias.length );
            //assert.equal( mosto_server.playlists[0].endDate, driver_playlists[0].endDate );
            assert.equal( fetcher.playlists[0].mode, driver_playlists[0].mode );
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
   
    describe('#last [FETCH] check ', function() {
        it("--should finish FETCH", function(done) {
            done(); 
        });
    });

});
