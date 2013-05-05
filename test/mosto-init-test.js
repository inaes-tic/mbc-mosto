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

describe('Mosto init test', function(done) {
    var mosto_server = undefined;

    this.timeout(15000);
    
    before(function(done) {
        melted.take(function() {
	        melted.stop(function(){
	            done();
	        });
        });
    });

    describe('#start mosto', function() {
	    it('-- starting mosto shouldnt throw error', function() {
	        mosto_server = silence(function(){ return new mosto(); });
	        assert.notEqual(mosto_server, undefined);
	    });
	    it('-- mvcp server connected should return false', function() {
	        var r = silence(function(){ return mosto_server.server_started; });
	        assert.equal(r, false);
	    });
    });

    describe('#start melted', function() {
	    before(function(done) {
            melted.start(function(){
		        done();
            });
	    });
	    it('-- mvcp server connected should return false', function() {
	        var r = silence(function(){ return mosto_server.server_started; });
	        assert.equal(r, false);
	    });
    });

    describe('#setup melted', function() {
	    it('-- mvcp server connected should return true', function(done) {
	        melted.start(function(pid){
                mosto_server.server = new mvcp_server( "melted" );       	            
		        melted.setup(undefined, undefined, function(has_err) {
                    mosto_server.startMvcpServer( function(done) { done(); } );
			        // time to next server_started update.
			        setTimeout(function(){
				        var r = mosto_server.server_started;
				        assert.equal(r, true);
				        done();
			        }, 1000);
		        });

	        });
	    });
    });

    describe('#leave melted', function() {
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
