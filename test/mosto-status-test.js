var assert = require("assert"),
    mosto  = require('../mosto'),
    melted  = require('../api/Melted');

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('Mosto status', function() {

    var mosto_server = undefined;
    var rec = -1;

    before(function(done) {
        melted.take(function() {
            melted.stop(function(pid){
                done();
            });
        });
    });


    describe('# status test: init mosto without playlists', function() {
        before(function(done) {
            melted.stop( function(pid) {
                mosto_server = new mosto();
                mosto_server.init(melted, function() {
                    mosto_server.heartbeats.once('clipStatus', function(status) {
                        console.warn("Frame: ", status.frame);
                        rec++;
                        done();
                    });
                });
            });
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
            mosto_server.heartbeats.on('clipStatus', function(status) {
                console.warn("Frame: ", status.frame);
                rec++;
                if (rec === 10) {
                    assert.equal(rec, 10);
                    done();
                }
            });
        });
    });


    after(function(done) {
        mosto_server.finish( function() {
            mosto_server = undefined;
            done();
        } );
    });


});
