var spawn = require('child_process').spawn;
var net = require('net');
var semaphore = require('semaphore')(1);

var conf = {
	bin: process.env.MELTED || "melted",
	root: process.env.MELTED_ROOT || process.env.PWD,
	host: process.env.MELTED_HOST || "localhost",
	port: process.env.MELTED_PORT || 5250,
	output: process.env.MELTED_OUTPUT || "sdl"    
};

var melted_bin_path = process.env.PWD+ '/melted/BUILD/bin/melted';
var melted_lib_path = process.env.PWD+ '/melted/BUILD/lib';

_meltedbin = function(callback,errorCallback) {
    console.log("Melted.js: executing _meltedbin()");    
	var pgrep = spawn( "which", ["melted"] );
    var pbin = melted_bin_path;

	pgrep.stdout.on('data', function (data) {
		pbin = data;
        console.log("Melted.js: data: " + data );
        conf.bin = pbin;
	});

	pgrep.on('exit', function (code) {
        if (code>1) {             
            conf.bin = pbin;
            errorCallback(code);
        } else if (code==1) {
            conf.bin = pbin;
            return callback(pbin);
        } else {
            conf.bin = pbin;
            return callback(pbin);
        }
	});

};


/**
 * _do
 *
 * Private function to connect to melted.
 *
 * @callback: Callback function to do to melted.
 */
_do = function(callback) {
//	var pgrep = spawn('pgrep', ['-x', "melted"]);
    var pgrep = spawn('pgrep', ["melted"]);
	var pid;

	pgrep.stdout.on('data', function (data) {
		pid = data;
	});

	pgrep.on('exit', function (code) {
		return callback(parseInt(pid));
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
		return callback(!isNaN(pid));
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
			//exports.connect(function(conn){ exports.push(conn, ['SHUTDOWN'], undefined, undefined); });
			var kill = spawn('kill',['-9',pid]);
			//kill.on('close', function(state) { return callback(pid) });
			kill.on('exit', function(code) { 
                if (code) console.log("returned with code:"+code);
                return callback(pid) 
            });
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
            _meltedbin( function(lbin) { 
                console.log("Melted.js: [INFO] Melted.start > melted_bin is at: "+conf.bin);

                if (process.env.LD_LIBRARY_PATH!==undefined) process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH+":"+melted_lib_path;
                else process.env.LD_LIBRARY_PATH = melted_lib_path;

			    var melted_proc = spawn(conf.bin, [], {detached: true, stdio: [ 'ignore', 'ignore', 'ignore' ]});
			    var pid = melted_proc.pid;
                melted_proc.on('exit', function(code) {                     
                    setTimeout(function() { callback(pid); }, 1000 );
                } );
            }, function(error) {
                callback(0);
            } );
		}
	})
};

/**
 * connect
 *
 * Connect to melted daemon.
 *
 * @callback : callback function when process is ready.
 */
exports.connect = function(callback) {
	var conn = net.createConnection(conf.port, conf.host);
	conn.setEncoding('ascii');
	callback(conn);
};

/**
 * push
 *
 * Push commands to melted daemon.
 *
 * @commands : list of commands to send.
 * @callback : callback function when process is ready.
 */
exports.push = function(conn, commands, command_callback, close_callback) {
	var s = 0;
	conn.on('connect', function() {
		conn.on('data', function(data) {
			if (command_callback) command_callback(data);
			if (s < commands.length && data.indexOf("\n") > -1) {
				conn.write(commands[s]+"\n");
				s = s + 1;
			};
		});
	});
	if (close_callback) conn.on('close', function(had_err) { close_callback(had_err); });
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
            console.log("Melted.js: [INFO] Melted.setup > setting up root:" + root + " ouput:" + output);
			var commands = [ 'NLS', 'SET root='+root, 'UADD '+output, 'BYE' ];
			exports.connect(function(conn){ exports.push(conn, commands, undefined, callback)});
		} else {
            callback(new Error("Melted.js: [ERROR] Can't connect to server. Server is not running!"));
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
 */
exports.leave = semaphore.leave;
