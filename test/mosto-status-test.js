var assert = require("assert");
var mosto  = require('../mosto.js');

var server = undefined;

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('Mosto status', function() {
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
        it('--should have received 5 status events', function() {
            this.timeout(6000);
            var rec = 0;
            server.on('status', function(status) {
                if(++rec == 5) {
                    done();
                }
            });
        });
    });
});
