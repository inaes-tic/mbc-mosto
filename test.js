var assert = require("assert");

var mosto_server = require('./mosto');
var mosto = new mosto_server();

describe('init', function(){
    describe('#config file loaded', function(){
        it('--should return the config file contents', function(){
            assert.notEqual(mosto.config, false);
        });
    });
    describe('#mvcp server connected', function(){
        it('--should return true', function(){
            assert.equal(mosto.server.server.mlt.connected, true);
        });
    });
    describe('#playlists loaded', function(){
        it('--should return != 0', function(){
            assert.notEqual(mosto.playlists.length, 0);
        });
    });

});
