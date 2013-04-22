var spawn = require('child_process').spawn;
var net = require('net');
var semaphore = require('semaphore')(1);

var conf = {
	bin: process.env.MELTED || "melted",
	root: process.env.MELTED_ROOT || process.env.PWD,
	host: process.env.MELTED_HOST || "localhost",
	port: process.env.MELTED_PORT || 5250,
	output: process.env.MELTED_OUTPUT || "sdl"
}

/**
 * _do
 *
 * Private function to connect to melted.
 *
 * @callback: Callback function to do to melted.
 */
_do = function(callback) {
	var pgrep = spawn('pgrep', ['-x', conf.bin]);
	var pid;

	pgrep.stdout.on('data', function (data) {
		pid = data;
	});

	pgrep.on('exit', function (code) {
		callback(parseInt(pid));
	});
};

/**
 * update_config
 *
 * Setup following melted attributes:
 *
 *   - bin: path to binary file.
 *   - root: path to videos files.
 *   - host: host where melted is running.
 *   - port: port where melted is running.
 *   - output: output device.
 *
 * @conf: Map with melted basic configuration.
 */
exports.update_config = function(new_config) {
	conf.bin   = new_config.bin || conf.bin;
	conf.root  = new_config.root || conf.root;
	conf.host  = new_config.host || conf.host;
	conf.port  = new_config.port || conf.port;
	conf.output= new_config.output || conf.output;
};

/**
 * get_config
 *
 * Return config object.
 */
exports.get_config = function() {
	return conf;
};


/**
 * is_running
 *
 * @callback: callback function when known if running or not.
 */
exports.is_running = function(callback) {
	_do(function(pid) {
		callback(!isNaN(pid));
	})
}

/**
 * stop
 *
 * Stop melted.
 *
 * @callback : callback function when process is stopped.
 */
exports.stop = function(callback) {
	_do(function(pid) {
		if (pid) { 
			var kill = spawn('kill',[pid]);
			kill.on('close', function(state) { return callback(pid) });
		} else
			callback(pid);
	})
};

/**
 * start
 *
 * Start melted deamon.
 *
 * @callback : callback function when process is ready.
 */
exports.start = function(callback) {
	_do(function(pid) {
		if (pid) {
			callback(pid);
		} else {
			console.log("Start:", conf.bin);
			melted_proc = spawn(conf.bin, []); //, {detached: true, stdio: [ 'ignore', 'ignore', 'ignore' ]});
			pid = melted_proc.pid;
			//melted_proc.unref()
			setTimeout(function() { callback(pid); }, 1000);
		}
	})
};

/**
 * setup
 *
 * Setup melted deamon.
 *
 * @callback : callback function when process is ready.
 */
exports.setup = function(root, output, callback) {
	root = root || conf.root;
	output = output || conf.output;
	_do(function(pid) {
		if (pid) {
			conn = net.createConnection(conf.port, conf.host);
			conn.setEncoding('ascii');
			var commands = [ 'NLS', 'SET root='+root, 'UADD '+output, 'BYE' ];
			var s = 0;
			conn.on('connect', function() {
				conn.on('data', function(data) {
					if (s < commands.length && data.indexOf("\n") > -1) {
						conn.write(commands[s]+"\n");
						s = s + 1;
					}
				});
			});
			conn.on('close', function(had_err) {
				callback(had_err);
			});
		} else {
			console.log("Can't connect to server. Server is not running!")
		};
	})
};

/**
 * take
 *
 * Take melted and not leave execution to other melted taked.
 *
 * @callback: callback function to process while take melted.
 *
 */
exports.take = semaphore.take;

/**
 * leave
 *
 * Leave execution to other melted taked.
 *
 * @callback: callback function to process while take melted.
 *
 */
exports.leave = semaphore.leave;
