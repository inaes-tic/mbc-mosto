var assert      = require("assert")
,   exec        = require('child_process').exec
,   mosto       = require('../mosto')
,   mvcp_server = require('../drivers/mvcp/mvcp-driver')
,   melted      = require('../api/Melted');


describe('Mosto init test', function(done) {
    var mosto_server = undefined;

    this.timeout(15000);

    before(function(done) {
        melted.take(function() {
            melted.stop(function(){
                done();
            });
        });
    });

    describe('#start mosto', function() {
        it('-- starting mosto shouldnt throw error', function() {
            mosto_server = silence(function(){ return new mosto(); });
            assert.notEqual(mosto_server, undefined);
        });
        it('-- mvcp server connected should return false', function() {
            var r = silence(function(){ return mosto_server.server_started; });
            assert.equal(r, false);
        });
    });

    describe('#start melted', function() {
        before(function(done) {
            melted.start(function(){
                done();
            });
        });
        it('-- mvcp server connected should return false', function() {
            var r = silence(function(){ return mosto_server.server_started; });
            assert.equal(r, false);
        });
    });

    describe('#setup melted', function() {
        it('-- mvcp server connected should return true', function(done) {
            melted.start(function(pid){
                mosto_server.server = new mvcp_server( "melted" );
                melted.setup(undefined, undefined, function(has_err) {                    
                    done();                    
                });

            });
        });
    });

    describe('#leave melted', function() {
        it('-- leave melted', function(done) {
            //mosto_server.stop();
            mosto_server = null;
            melted.stop(function(pid) {
                melted.leave();
                done();
            });
        });
    });

});
