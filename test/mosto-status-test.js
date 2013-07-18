var assert = require("assert"),
    mosto  = require('../mosto'),
    melted  = require('../api/Melted');

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe.skip('Mosto status', function() {

    var mosto_server = undefined;
    var rec = -1;

    before(function(done) {
        melted.take(function() {
                        console.error("MELTED 1");
            melted.stop(function(){
                        console.error("MELTED 2");
                melted.start(function() {
                        console.error("MELTED 3");
                    melted.setup(undefined, undefined, function() {
                        console.error("MELTED READY");
//                        melted.leave();
                        done();
                    });
                });
            });
        });
    });


    describe('# status test: init mosto without playlists', function() {
        before(function(done) {
            mosto_server = new mosto();
            mosto_server.once('status', function(status) {
                rec++;
                done();
            });
            mosto_server.init(melted);
        });
        it('--should have received 1 status', function() {
            assert.equal(rec, 0);
        });
    });


    describe('#suscribe to status and wait 1 second', function() {
        before(function(done) {
            rec = 0;
            done();
        });
        it('--should have received at least 10 status events', function(done) {
            this.timeout(1000);
            mosto_server.on('status', function(status) {
                rec++;
                if (rec === 10) {
                    assert.equal(rec, 10);
                    done();
                }
            });
        });
    });


    after(function(done) {
        mosto_server.finish(done);
    });


});
