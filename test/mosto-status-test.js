var assert = require("assert"),
    exec   = require('child_process').exec,
    mosto  = require('../mosto'),
    mvcp_server      = require('../drivers/mvcp/mvcp-driver'),
    melted  = require('../api/Melted');

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
	        	mosto_server = silence(function(){ return new mosto(); });
                mosto_server.once('statusclip', function(stclip) {
                    ++rec;
			        done();
                });
                mosto_server.init( melted, function() {                
                });
            });
	    });
	    it('--should be instantiated', function() {
	        assert.notEqual( mosto_server, undefined);                
	    });
    });


    describe('#suscribe to status and wait 5 seconds', function() {
	    it('--should have received 5 status events', function(done) {
	        mosto_server.on('statusclip', function(stclip) {
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
