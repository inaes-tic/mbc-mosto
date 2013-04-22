var assert = require("assert");

var mosto = require('../mosto.js');
var server = undefined;
var config = {
            fps: "25",
            resolution: "hd",
            playout_mode: "direct",
            playlist_maxlength: "4 hours",
            scheduled_playlist_maxlength: "04:00:00",
            timer_interval: "1000",
            black: '../images/black.png',
            reload_timer_diff: "20000",
            playlist_server: "json",
            mvcp_server: "melted"
        };

//TODO: This test should be rewritten after @fabriciocosta merges his part with more usefull data!
describe('Mosto status', function() {
    before(function(done) {
        server = new mosto(config);
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
