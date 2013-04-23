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
    
    after(function(done) {
        console.log('Status: ', self.mosto_status);
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
        it('--status object should not be undefined', function() {
            assert.notEqual(self.mosto_status, undefined);
        });
        it('--status.actualClip.fps should be = 25', function() {
            assert.equal(parseInt(self.mosto_status.clip.current.fps), 25);
        });
        it('--status.actualClip.currentFrame should be = 0', function() {
            assert.equal(parseInt(self.mosto_status.clip.current.currentFrame), 0);
        });
        it('--status.actualClip.totalFrames should be = 1', function() {
            assert.equal(parseInt(self.mosto_status.clip.current.totalFrames), 1);
        });
    });
});
