var assert = require("assert");
var melted = require('../api/Melted');

describe('Melted', function(){
	describe('#take - #leave', function(){
		var serie = "";
		it('Semaphore leaved', function(done) {
			melted.leave();
		});
		it('Async semaphore checking', function(done) {
			melted.take(function() {
				serie = serie + ["1"];
				setTimeout(function(){serie = serie + "1"; melted.leave();},50);
			});
			melted.take(function(leave, start, stop, get_setup, setup) {
				serie = serie + ["2"];
				setTimeout(function(){serie = serie + "2"; melted.leave();},1);
			});
			melted.take(function() {
				serie = serie + ["3"];
				setTimeout(function(){serie = serie + "3"; melted.leave();},10);
			});
			melted.take(function() {
				melted.leave();
				assert.equal(serie, "112233");
				done();
			});
		});
	});

	describe('#start', function(){
		it('melted should be started', function(done){
			melted.take(function() {
				melted.start(function(pid) {
					melted.is_running(function(is) {
						melted.leave();
						assert.equal(true, is);
						done();
					})
				});
			});
		});
	});

	describe('#stop', function(){
		it('melted should be stopped', function(done){
			melted.take(function() {
				melted.stop(function(pid) {
					melted.is_running(function(is) {
						melted.leave();
						assert.equal(false, is);
						done();
					})
				});
			});
		});
	});

	describe('#get_config - #update_config - #setup', function(){
		it('original configuration ok', function(){
			assert.notEqual(melted.get_config().root, "/home/");
		});
		it('new configuration ok', function(){
			melted.update_config({root: '/home/'});
			assert.equal(melted.get_config().root, "/home/");
		});
		it('setup happens', function(done){
			melted.take(function() {
				melted.start(function(pid) {
					melted.setup(undefined, undefined, function(had_err) {
						melted.leave();
						assert.equal(had_err, false);
						done();
					});
				});
			});
		});
	});

});

