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
    mosto_scheduler  = require('../scheduler'),
    mosto_synchronizer  = require('../sync'),
    mosto_player  = require('../play'),
    _                = require('underscore');

describe('Mosto [LOGIC/Scheduler] section tests', function(done) {
    var mosto_server = undefined;
    var server = undefined;

    var fetcher = undefined;
    var scheduler = undefined;
    var synchronizer = undefined;
    var player = undefined;

    this.timeout(15000);

    before(function(done) {
        melted.take(function() {
		    melted.stop(function(){
    	        done();
    	    });
	    });
    });

    describe('#[LOGIC/SCHED] start mosto', function() {
	    it('-- starting mosto shouldnt throw error', function() {
	        mosto_server = silence(function(){ return new mosto(); });
	        assert.notEqual(mosto_server, undefined);
            mosto_server.driver = new test_driver();

            //mosto_server.fetcher        = new mosto_fetcher( { mosto: mosto_server } );
            mosto_server.scheduler        = new mosto_scheduler( { mosto: mosto_server } );
            //mosto_server.synchronizer        = new mosto_synchronizer( { mosto: mosto_server } );
            //mosto_server.player        = new mosto_player( { mosto: mosto_server } );

            //fetcher = mosto_server.fetcher;
            scheduler = mosto_server.scheduler;

            //mosto_server.fetcher.init();
            mosto_server.scheduler.init();
            //mosto_server.synchronizer.init();
            //mosto_server.player.init();

            //synchronizer = mosto_server.synchronizer;
            //player = mosto_server.player;

	    });
	    it('-- mvcp server connected should return false', function() {
	        var r = silence(function(){ return mosto_server.server_started; });
	        assert.equal(r, false);
	    });
    });


    describe("#[LOGIC/SCHED] Checking start with no playlists", function() {
        it("--should return no clips", function(done) {
            assert.equal( scheduler.scheduled_clips.length, 0 );
            done();
        });
    });

    describe("#[LOGIC/SCHED] Adding playlists", function() {

        var playlist = undefined;
        var splaylists = [];

        before(function(done){
            mosto_server.driver.start();
            playlist = mosto_server.driver.TestPlaylist( 0 );
            splaylists.push(playlist);
            done();
        });
        it("--scheduler should receive data", function(done) {                
            scheduler.once('datareceived', function (playlists) {
                console.log("mosto-logic-test: [SCHED TEST] Adding: fetch_downstream and datareceived ok!");
                console.log(playlists);
                (_.isEqual( splaylists[0], playlist)) ? done() : done( new Error("playlists[0] and playlist doesn't match."));
            });
            //fetcher.addPlaylist( playlist );
            scheduler.emit('datasend', splaylists);
        });

        it("--scheduler should convert to scheduled_clips for the next upstreamCheck", function(done) {                
            scheduler.once('sched_downstream', function (sched_clips) {
                console.log("mosto-logic-test: [SCHED TEST] Adding: sched_downstream ok! sched_clips: " + sched_clips.length + " vs " + playlist.medias.length);
                for( var i=0; i<playlist.medias.length; i++ ) {                    
                    if (!_.isEqual( playlist.medias[i], sched_clips[i].media )) {
                        return done(new Error( playlist.medias[i] + "!=" + sched_clips[i].media ));
                    }
                }
                done();                
            });        
            scheduler.emit('upstreamcheck');
        });


    });

    describe("#[LOGIC/SCHED] Adding playlists in the near future", function() {

        var playlist1 = undefined;
        var playlist2 = undefined;
        var splaylists = [];
        var start_playlist = undefined;

        before(function(done){

            mosto_server.driver.start();

            playlist1 = mosto_server.driver.TestPlaylist( 20000 );
            playlist2 = mosto_server.driver.TestPlaylist( 20000+90000 );

            splaylists.push(playlist1);
            splaylists.push(playlist2);

            start_playlist = moment( playlist1.startDate ).format("DD/MM/YYYY HH:mm:ss");

            done();
        });
        it("--scheduler should receive data", function(done) {                
            scheduler.once('datareceived', function (playlists) {
                console.log("mosto-logic-test: [SCHED TEST] datareceived ok!");
                //console.log( playlists );
                (_.isEqual( splaylists[0], playlist1) && _.isEqual( splaylists[1], playlist2)) ? done() : done( new Error("playlists[0] and playlist doesn't match."));
            });
            scheduler.emit('datasend', splaylists);
        });

        it("--scheduler should convert to scheduled_clips", function(done) {                
            scheduler.once('sched_downstream', function (sched_clips) {
                console.log("mosto-logic-test: [SCHED TEST] Adding: sched_downstream ok! sched_clips: " + sched_clips.length);
                console.log(sched_clips);
                assert.equal( sched_clips.length, 8 );//1 black at the start, 6 clips + 1 black at the end
                for( var i=1; i<sched_clips.length-1; i++ ) {
                    var pl_index = Math.floor( (i-1) / 3 );
                    var cl_index = Math.floor( (i-1) % 3 );
                    console.log("pl_index:"+ pl_index + " cl_index:" + cl_index);
                    if (!_.isEqual( sched_clips[i].media, splaylists[ pl_index ].medias[cl_index] )) {
                        return done(new Error( sched_clips[i].media.id+" not Equal to "+ splaylists[pl_index].medias[cl_index] ));
                    }
                }
                done();                
            });        
            scheduler.emit('upstreamcheck');
        });

    });


    describe("#[LOGIC/SCHED] Adding multiple playlists with intersections. ", function() {

        var playlist1 = undefined;
        var playlist2 = undefined;
        var playlist3 = undefined;
        var playlist4 = undefined;
        var splaylists = [];
        var start_playlist = undefined;

        before(function(done){
            mosto_server.driver.start();
            playlist1 = mosto_server.driver.TestPlaylist( -9000 );
            playlist2 = mosto_server.driver.TestPlaylist( 80000 ); // 1 second intersection
            playlist3 = mosto_server.driver.TestPlaylist( 80000 + 89000 );//1 second intersection
            playlist4 = mosto_server.driver.TestPlaylist( 80000 + 89000 + 89000 );//1 second intersection
            splaylists.push(playlist1);
            splaylists.push(playlist2);
            splaylists.push(playlist3);
            splaylists.push(playlist4);
            start_playlist = moment( playlist1.startDate ).format("DD/MM/YYYY HH:mm:ss");
            done();
        });
        it("--scheduler should receive data", function(done) {                
            scheduler.once('datareceived', function (playlists) {
                console.log("mosto-logic-test: [SCHED TEST] Adding: fetch_downstream and datareceived ok!");
                console.log( playlists );
                (_.isEqual( splaylists[0], playlist1) && _.isEqual( splaylists[1], playlist2)) ? done() : done( new Error("playlists[0] and playlist doesn't match."));
            });
            //fetcher.addPlaylist( playlist );
            scheduler.emit('datasend', splaylists);
        });

        it("--scheduler should convert to scheduled_clips. And sched_clips must be all queued", function(done) {                
            scheduler.once('sched_downstream', function (sched_clips) {
                console.log("mosto-logic-test: [SCHED TEST] Adding: sched_downstream ok! sched_clips: " + sched_clips.length);
                for( var p=0; p<splaylists.length; p++ ) {
                    for( var i=0; i<splaylists[p].medias.length; i++ ) {                    
                        if (!_.isEqual( splaylists[p].medias[i], sched_clips[i].media ) 
                            && ( sched_clips[i].schedule_time=="now" || sched_clips[i].schedule_time==start_playlist ) ) {
                            return done(new Error( splaylists[p].medias[i] + "!=" + sched_clips[i].media ));
                        }
                    }
                }
                done();                
            });        
            scheduler.emit('upstreamcheck');
        });

    });


    describe("#[LOGIC/SCHED] Updating playlist", function() {

        var playlist = undefined;
        var playlists = [];

        before(function(done){
            playlist = mosto_server.driver.TestPlaylist();
            playlist.medias.splice( 2, 1 );
            playlists.push(playlist);
            done();
        });
        it("--should return the first clip of playlist", function(done) {
            scheduler.once( 'datareceived', function( playlists ) {
                console.log("mosto-logic-test: [SCHED TEST] Updating: fetch_downstream and datareceived ok!" + " rec_count:" + scheduler.rec_count + " ret_count:" + scheduler.ret_count );
                //console.log(playlists[0].id);                
                scheduler.once( 'sched_downstream', function( sched_clips ) {
                    //assert.notEqual( sched_clips.length, 0 );
                    //assert.equal( sched_clips[0].media.id, playlist.medias[0].id );
                    console.log("mosto-logic-test: [SCHED TEST] Updating: sched_downstream ok! sched_clips: " + sched_clips.length + " vs " + playlist.medias.length);
                    for( var i=0; i<playlist.medias.length; i++ ) {                    
                        if (!_.isEqual( playlist.medias[i], sched_clips[i].media )) {
                            return done(new Error( playlist.medias[i] + "!=" + sched_clips[i].media ));
                        }
                    }
                    done();
                });
                scheduler.emit('upstreamcheck');
            });
            //fetcher.updatePlaylist( playlist );
            scheduler.emit('datasend', playlists);

        });               
    });

    describe("#[LOGIC/SCHED] Remove playlist test", function() {

        var splaylists = [];

        before(function(done){
            done();
        });
        it("--should return only the blank black_id", function(done) {
            scheduler.once( 'datareceived', function( playlists ) {
                console.log("mosto-logic-test: [SCHED TEST] Removing: fetch_downstream and datareceived ok!" + " rec_count:" + scheduler.rec_count + " ret_count:" + scheduler.ret_count );
                scheduler.once( 'sched_downstream', function( sched_clips ) {
                    if (sched_clips.length==1 && ( sched_clips[0].media.id == "black_id" ) ) {
                        return done();
                    } else return done(new Error("No black id"));
                });
                scheduler.emit('upstreamcheck');
            });
            //fetcher.removePlaylist( "test_playlist_1_id" );
            scheduler.emit( 'datasend', splaylists );
        });                   
    });

    describe('#[LOGIC/SCHED] leave melted', function() {
	    it('-- leave melted', function(done) {
		    //mosto_server.stop();
		    mosto_server = null;
		    melted.stop(function(pid) {
			    melted.leave();
			    done();
		    });
	    });
    });

    describe('#last [LOGIC/SCHED] check ', function() {
        it("--should finish LOGIC", function(done) {
            done(); 
        });
    });


});
