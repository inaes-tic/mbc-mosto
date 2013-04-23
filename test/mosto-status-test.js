var assert = require("assert");
var mosto  = require('../mosto.js');

var server = undefined;

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('Mosto status', function() {
    var self = this;
    self.rec = 0;
    self.mosto_status = undefined;
    before(function(done) {
        server = new mosto();
        done();
    });

    describe('init mosto', function() {
        describe('#mosto server up', function() {
            it('--should be instantiated', function() {
                assert.notEqual(server, undefined);
            });
        });
    });

    describe('suscribe to status and wait 5 seconds', function() {
        before(function(done) {
            var id = setInterval(function() {
                server.sendStatus();
            }, 1000);
            this.timeout(6000);
            server.on('status', function(status) {
                self.mosto_status = status;
                self.rec++;
                if(self.rec === 5) {
                    clearInterval(id);
                    done();
                }
            });
        });
        it('--should have received 5 status events', function() {
            assert.equal(self.rec, 5);
        });
    });
});
