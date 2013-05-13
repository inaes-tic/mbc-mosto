var assert = require("assert"),
    exec   = require('child_process').exec,
    mosto  = require('../mosto'),
    mvcp_server      = require('../drivers/mvcp/mvcp-driver'),
    melted  = require('../api/Melted');

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('Mosto status', function() {

    var mosto_server = undefined;
    var rec = -1;

    before(function(done) {
        melted.take(function() {
		    melted.stop(function(pid){
    	        done();
    	    });
	    });
    });


    describe('# status test: init mosto', function() {
	    before(function(done) {
            melted.stop( function(pid) {
	        	mosto_server = new mosto();
                mosto_server.init( melted, function() {
                    mosto_server.player.once('statusclip', function(stclip) {
                        ++rec;
			            done();
                    });
                });
            });
	    });
	    it('--should be instantiated', function() {
	        assert.notEqual( mosto_server, undefined);                
	    });
    });

    
    describe('#suscribe to status and wait 5 seconds', function() {

	    it('--should have received 5 status events', function(done) {
            this.timeout(6000);
	        mosto_server.player.on('statusclip', function(stclip) {
                console.log("mbc-mosto: [PLAY] emitting statusclip: " + stclip.currentFrame + " / "+  stclip.totalFrames);
		        if(++rec == 5) {
		            done();
		        }
	        });
	    });
    });


    after(function(done) {
        mosto_server.finish( function() {
            mosto_server = undefined;
            done();
        } );
    });


});
