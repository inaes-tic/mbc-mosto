var assert = require("assert");
var melted = require('../api/Melted');

describe('Melted', function(){

	describe('#semaphore', function(){
		var serie = ""
		melted.take(function() {
			serie = serie + ["1"];
			setTimeout(function(){serie = serie + "1"; melted.leave();},1000);
		});
		melted.take(function(leave, start, stop, get_setup, setup) {
			serie = serie + ["2"];
			setTimeout(function(){serie = serie + "2"; melted.leave();},1);
		});
		melted.take(function() {
			serie = serie + ["3"];
			setTimeout(function(){serie = serie + "3"; melted.leave();},100);
		});
		melted.take(function() {
			it('Async semaphore checking', function() {
				assert.equal(serie == "112233");
			});
			melted.leave();
		});
	});

	describe('#start', function(){
		melted.take(function() {
			melted.start(function(pid) {
				melted.is_running(function(is) {
					it('melted should be started', function(){
						assert.equal(true, is);
						melted.leave();
					})
				});
			});
		});
	});

	describe('#stop', function(){
		melted.take(function() {
			melted.stop(function(pid) {
				melted.is_running(function(is) {
					it('melted should be stopped', function(){
						assert.equal(false, is);
						melted.leave();
					})
				});
			});
		});
	});

	describe('#change setup', function(){
		melted.take(function() {
			melted.update_config({root: '/home/'});
			it('new configuration ok', function(){
				assert.equal(melted.get_config().root, "/home/");
				melted.leave();
			});
		});
	});

	describe('#setup', function(){
		melted.take(function() {
			melted.stop(function(pid) {
				melted.start(function(pid) {
					melted.setup(undefined, undefined, function(had_err) {
						it('setup happens', function(){
							assert.equal(had_err, false);
							melted.leave();
						});
					});
				});
			});
		});
	});
})

