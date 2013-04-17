var assert = require("assert");

var mosto = require('../mosto.js');
var server = undefined;

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('init mosto', function() {
    before(function(done) {
        server = new mosto('./test/mosto-status-test-config.json');
        done();
    });
    describe('#mosto server up', function() {
        it('--should be instantiated', function() {
            assert.notEqual(server, undefined);
        });
    });
});

describe('suscribe to status and wait 5 seconds', function() {
    this.timeout(6000);
    var rec = 0;
    before(function(done) {
        server.on('status', function(status) {
            console.log(status);
            rec++;
        });
        setTimeout(function() {
            done();
        }, 5500);
    });
    describe('#mosto status received', function() {
        it('--should have received 5 status events', function() {
            assert.equal(rec, 5);
        });
    });
});