var assert = require("assert"),
    exec   = require('child_process').exec, 
    mosto  = require('../mosto');

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

describe('start without melted', function() {
    var mosto_server = undefined;
    
    before(function(done) {
        exec("killall melted", function(error, stdout, stderr) {
            done();
        });
    });
    describe('#start mosto', function() {
        it('-- starting mosto shouldnt throw error', function() {
//            assert.doesNotThrow(function() {
//                mosto_server = require('../mosto');
//                done();
//            });
            mosto_server = new mosto();
            assert.notEqual(mosto_server, undefined);
        });
        it('-- mvcp server connected should return false', function() {
            assert.equal(mosto_server.server_started, false);
        });
    });
    describe('#start melted', function() {
        before(function(done) {
            exec("melted", {"timeout": "1000"}, function(error, stdout, stderr) {
                if (error)
                    console.error(error);
                done();
            });
        });
        it('-- mvcp server connected should return false', function() {
            assert.equal(mosto_server.server_started, false);
        });
    });
    describe('#add unit 0 to melted', function() {
        before(function(done) {
            exec("echo 'uadd sdl' | nc localhost 5250", function(error, stdout, stderr) {
                setTimeout(function() {
                    if (error)
                        console.error(error);
                    done();
                }, 5000);
            });
        });
        it('-- mvcp server connected should return true', function() {
            assert.equal(mosto_server.server_started, true);
        });
    });
});