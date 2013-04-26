var assert = require("assert");

var mosto = require('../mosto.js'),
    melted  = require('../api/Melted');
var config = {
            fps: "25",
            resolution: "hd",
            playout_mode: "direct",
            playlist_maxlength: "4 hours",
            scheduled_playlist_maxlength: "04:00:00",
            timer_interval: "1000",
            black: '../images/black.png',
            reload_timer_diff: "20000",
            playlist_server: "json",
            mvcp_server: "melted"
        };

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

    melted.take(function() {
	    describe('#init mosto', function() {
		    it('--init mosto server', function(done) {
		    	mosto_server = silence(function(){ return new mosto(config); });
			done();
		    });
		    it('--should be instantiated', function() {
			assert.notEqual(mosto_server, undefined);
		    });
	    });
	    describe('#leave melted', function() {
		    it('--- leave melted', function(done) {
			    mosto_server.stop()
			    mosto_server = null;
			    melted.stop(function(pid) {
				    melted.leave();
				    done();
			    });
		    });
	    });

/*
	    describe('suscribe to status and wait 5 seconds', function() {
		it('--should have received 5 status events', function(done) {
		    this.timeout(6000);
		    var rec = 0;
		    server.on('status', function(status) {
			if(++rec == 5) {
			    done();
			}
		    });
		});
	    });
*/
    });
});
