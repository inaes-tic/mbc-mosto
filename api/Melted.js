var sys = require('util');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var execSync = require('execSync');
var event_emitter = require('events').EventEmitter;
var waitpid = require('waitpid');

var child;
var melted;
var killed = false

melted = process.env.MELTED || "melted";
console.info("Melted:", melted)

exports.start = function() {
	child = spawn(melted,["-test"]);
	child.on('exit', function() { console.log('Ahh!'); killed = true;})
};

exports.is_running = function() {
	var psgrep = execSync.exec('pgrep -x ' + melted);
	return (psgrep.code == 0);
};

exports.stop = function() {
	child.kill("SIGKILL");
	waitpid(child.pid);
};

exports.ListActiveNodes = function() {
};

exports.CreateNode = function() {
};

exports.setPath = function() {
};

