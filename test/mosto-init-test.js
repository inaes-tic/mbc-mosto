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
    
    this.timeout(15000);
    
    before(function(done) {
        exec("make melted-kill", {"timeout": "1000"}, function(error, stdout, stderr) {
            done();
        });
    });
    describe('#start mosto', function() {
        it('-- starting mosto shouldnt throw error', function() {
            mosto_server = new mosto();
            assert.notEqual(mosto_server, undefined);
        });
        it('-- mvcp server connected should return false', function() {
            assert.equal(mosto_server.server_started, false);
        });
    });
    describe('#start melted', function() {
        before(function(done) {
            exec("make melted-run", {"timeout": "1000"}, function(error, stdout, stderr) {
                if (error)
                    console.error(error);
                done();
            });
        });
        it('-- mvcp server connected should return false', function() {
            assert.equal(mosto_server.server_started, false);
        });
    });
    describe('#setup melted', function() {
        before(function(done) {
            exec("make melted-test-run", {"timeout": "1000"}, function(error, stdout, stderr) {
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