var assert = require("assert"),
    moment           = require('moment'),
    events   = require ('events'),
    util     = require ('util'),
    exec   = require('child_process').exec,
    mvcp_server      = require('../drivers/mvcp/mvcp-driver'),
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

describe('Mosto [LOGIC/Scheduler] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    this.timeout(15000);

    melted.take(function() {
	    before(function(done) {
		    melted.stop(function(){
		        done();
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

        function test_pl_driver() {
            events.EventEmitter.call (this);
            this.window = {};
        };

        util.inherits ( test_pl_driver, events.EventEmitter);

        test_pl_driver.prototype.getPlaylists = function( ops, callback ) {
            var playlists = [];
    
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
                var clip = new Media(  files[i].substring(files[i].lastIndexOf("/") + 1)+"_id", 0, undefined, 1, files[i].substring(files[i].lastIndexOf("/") + 1), "default", files[i], "00:00:30.00", 25 );
                medias.push(clip);
            }

            var startDate = moment().toDate();
            var endDate = moment( startDate ).add( moment.duration({seconds:90})).toDate();
            playlist = new Playlist( "test_pl_1_id", "test_pl_1_name", startDate, medias, endDate, "snap", false );
            return playlist;
        }


        describe("#[LOGIC] Checking no playlists", function() {
            it("--should return black_id", function(done) {
                assert.equal( mosto_server.playlists.length, 0 );
                assert.equal( mosto_server.scheduled_clips.length, 0 );
                done();
            });
        });


        describe("#[LOGIC] Adding playlist", function() {

            var playlist = new TestPlaylist();

            before(function(done){
                mosto_server.addPlaylist( playlist );
                done();
            });
            it("--should return same playlist ", function(done) {
                var result = true;
                assert.equal( mosto_server.scheduled_clips.length, 4 );
                assert.equal( mosto_server.scheduled_clips[0].media.id, playlist.medias[0].id );
                assert.equal( mosto_server.scheduled_clips[1].media.id, playlist.medias[1].id );
                assert.equal( mosto_server.scheduled_clips[2].media.id, playlist.medias[2].id );
                assert.equal( mosto_server.scheduled_clips[3].media.id, "black_id" );
                done();
            });

        });

        describe("#[LOGIC] Updating playlist", function() {

            var playlist = new TestPlaylist();

            before(function(done){
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
                mosto_server.removePlaylist( "test_pl_1_id" );
                done();
            });
            it("--should return only the blank black_id", function(done) {
                assert.equal( mosto_server.playlists.length, 1 );
                assert.equal( mosto_server.playlists[0].id, "black_id" );
                //assert.notEqual( mosto_server.scheduled_clips.length, 0 );
                done();
            });           
            
        });

        describe("#[LOGIC] Doing a checkoutPlaylists()", function() {
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

    });

    describe('#last [LOGIC] check ', function() {
        it("--should finish LOGIC", function(done) {
            done(); 
        });
    });


});

