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

function test_pl_driver() {
    events.EventEmitter.call (this);
    this.window = {};
};

util.inherits ( test_pl_driver, events.EventEmitter);

test_pl_driver.prototype.start = function(timeSpan) {
    var self = this;
    self.setWindow( { from: moment(), to: moment().add(moment.duration({ hours: 4 })), setWindow: true } );
};

test_pl_driver.prototype.getPlaylists = function( ops, callback ) {
    var playlists = [];
/*
    var playlist = undefined;            
    var files =  {  0: "../videos/SMPTE_Color_Bars_01.mp4",
                    1: "../videos/SMPTE_Color_Bars_02.mp4",
                    2: "../videos/SMPTE_Color_Bars_03.mp4" };
    var medias = [];

    for( var i=0; i<3; i++ ) {
        var clip = new Media(  files[i].substring(files[i].lastIndexOf("/") + 1)+"_id", 0, undefined, 1, files[i].substring(files[i].lastIndexOf("/") + 1), "default", files[i], "00:00:30.00", 25 );
        medias.push(clip);
    }

    var startDate = moment().toDate();
    var endDate = moment( startDate ).add( moment.duration({seconds:90})).toDate();
    playlist = new Playlist( "test_pl_1_id", "test_pl_1_name", startDate, medias, endDate, "snap", false );

    playlists.push(playlist);
*/
    callback(playlists);

};

test_pl_driver.prototype.getWindow = function( from, to) {        
    var window = {
        from: moment(from),
        to: moment(to),
    };
    window.timeSpan = window.to.diff(window.from);
    return window;            
};

test_pl_driver.prototype.setWindow = function(from, to) {
    var self = this;
    self.window = self.getWindow(from, to);
    return self.window;
};

function TestPlaylist() {
    var playlist = undefined;            
    var files =  {  0: "../videos/SMPTE_Color_Bars_01.mp4",
                    1: "../videos/SMPTE_Color_Bars_02.mp4",
                    2: "../videos/SMPTE_Color_Bars_03.mp4" };
    var medias = [];

    for( var i=0; i<3; i++ ) {
        var clip = new Media(  files[i].substring(files[i].lastIndexOf("/") + 1)+"_id", 0, undefined, 1, files[i].substring(files[i].lastIndexOf("/") + 1), "file", files[i], "00:00:30.00", 25 );
        console.log("clip " + clip.id + " media:" + clip.file + " length:" + clip.length );
        medias.push(clip);

    }

    var startDate = moment().toDate();
    var endDate = moment( startDate ).add( moment.duration({seconds:90})).toDate();
    playlist = new Playlist( "test_pl_1_id", "test_pl_1_name", startDate, medias, endDate, "snap", false );
    return playlist;
}



describe('Mosto [PLAY/Timer event] tests', function(done) {

    var mosto_server = undefined;

    this.timeout(15000);

    melted.take(function() {
	    before(function(done) {
		    melted.stop(function(){
		        done();
		    });
	    });

	    describe('#[PLAY] start mosto', function() {
		    it('-- starting mosto shouldnt throw error', function() {
		        mosto_server = silence(function(){ return new mosto(); });
		        assert.notEqual(mosto_server, undefined);
		    });
		    it('-- mvcp server connected should return false', function() {
		        var r = silence(function(){ return mosto_server.server_started; });
		        assert.equal(r, false);
		    });
	    });


	    describe('#[PLAY] start melted', function() {
		    before(function(done) {
                melted.start(function(pid){                    
    		        done();
	            });
		    });
            it('-- mvcp server created', function(done) {
		        mosto_server.server = silence(function(){ return mvcp_server("melted"); });
                mosto_server.status_driver = new status_driver();
                mosto_server.driver = new test_pl_driver();

		        assert.notEqual( mosto_server.server, undefined);
                assert.notEqual( mosto_server.driver, undefined);
                done();
		    });    
	    });


	    describe('#[PLAY] setup melted and connect', function() {
            describe('#[PLAY] mvcp server connected', function(){
		        it('--should return true', function(done) {
                    var result = mosto_server.server.initServer();
		            melted.start(function(pid){
			            melted.setup(undefined, undefined, function(has_err) {                        
				            // time to next server_started update.
				            setTimeout(function(){
					            assert.equal(mosto_server.server.isConnected(), true);
					            done();
				            }, 1000);
			            });

		            });
		        });
		    });
	    });


        describe("#[PLAY] Initializing mosto driver and play.", function() {
            before(function(done) {
                mosto_server.initDriver();
                mosto_server.play();               
                done();
		    });
            it("--should timer have been created", function(done) {
                assert.notEqual( mosto_server.timer, undefined );
                assert.notEqual( mosto_server.timer, null );
                done();
            });
        });
        
        describe("#[PLAY] Checking no playlists, play blank.", function() {
            it("--should return black_id playing!!", function(done) {
                    mosto_server.once('converted', function(mess) {                        
                        assert.notEqual( mosto_server.playlists.length, 0 );
                        assert.notEqual( mosto_server.scheduled_clips.length, 0 );
                        assert.equal( mosto_server.scheduled_clips[0].media.id, "black_id" );
                        done();
                    });                    

                });
        });


        describe("#Adding playlist", function() {

            var playlist = null;

            before(function(done){
                playlist = TestPlaylist();
                mosto_server.addPlaylist( playlist );
                done();
            });
            it("--should be playing first clip of added playlist", function(done) {                
                function is_playing_media( clipid, intents, interv ) {
                    assert.notEqual( intents, 0 , done(new Error("Too much intents.")));
                    mosto_server.once('playing', function(mess3) {
                        console.log(mess3);
                        if ( mosto_server.actual_playing_clip == clipid ) {
                            done();
                        } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                    });
                }

                mosto_server.once('converted', function(mess1) {
                    assert.equal( mosto_server.playlists.length, 1 );
                    mosto_server.once('synced', function(mess2) {                        
                        is_playing_media( playlist.medias[0].id, 3, 500 );
                    });
                });
            });

        });


        describe("#Updating playlist", function() {

            var playlist = null;

            before(function(done){
                playlist = TestPlaylist();
                playlist.medias.splice( 2, 1 );
                mosto_server.updatePlaylist( playlist );
                done();
            });
            it("--should return the same playlist updated", function(done) {
                function is_playing_media( clipid, intents, interv ) {
                    if (intents==0) return done();
                    mosto_server.once('playing', function(mess3) {
                        console.log(mess3);
                        if ( mosto_server.actual_playing_clip == clipid ) {
                            done();
                        } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                    });
                }
                mosto_server.once('converted', function(mess1) {
                    assert.equal( mosto_server.playlists.length, 1 );
                    mosto_server.once('synced', function(mess2) {
                        is_playing_media( playlist.medias[0].id, 3, 500 );
                    });
                });
            });               
        });


        describe("#Remove playlist", function() {
            before(function(done){
                mosto_server.removePlaylist( "test_pl_1_id" );
                done();
            });
            it("--should return only the blank black_id", function(done) {
                function is_playing_media( clipid, intents, interv ) {
                    if (intents==0) return done();
                    mosto_server.once('playing', function(mess3) {
                        console.log(mess3);
                        if ( mosto_server.actual_playing_clip == clipid ) {
                            done();
                        } else setTimeout( is_playing_media( clipid, intents-1 ), interv);            
                    });
                }
                mosto_server.once('converted', function(mess1) {
                    assert.equal( mosto_server.playlists.length, 1 );
                    mosto_server.once('synced', function(mess2) {
                        is_playing_media( "black_id", 3, 500 );
                    });
                });
            });           
            
        });

/*
        describe("#Doing a checkoutPlaylists()", function() {
            var driver_playlists = undefined;

            before(function(done){
                mosto_server.driver = new test_pl_driver();
                mosto_server.driver.getPlaylists( { from: mosto_server.time_window_from, to: mosto_server.time_window_to, setWindow: false }, function(playlists) {
                    driver_playlists = playlists
                    mosto_server.playlists = [];
                    mosto_server.checkoutPlaylists();      
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
*/
	    describe('#[PLAY] leave melted', function() {
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

    describe('#last [PLAY] check ', function() {
        it("--should finish PLAY", function(done) {
            done(); 
        });
    });

});

