var assert      = require("assert"),
    exec        = require('child_process').exec,
    _           = require('underscore'),
    StreamerCom = require('../api/StreamerCom');

describe('Streamer Com test', function(done) {

    this.timeout(2000);

    var streamercom = undefined;
    var testdata1 = {
        "datainfo": "clips",
        "data": ["clip1","clip2","clip3"]
    };

    var testdata2 = {
        "datainfo": "clips",
        "data": ["clip1","clip2","clip3","clip4","clip5"]
    };


    before(function(done) {
        streamercom = new StreamerCom();
        done();
    });

    describe('StreamerCom methods test', function() {
        it('Return opened when data receiver is opened.',function(done) {
            assert.equal( streamercom.Open(), true );
            assert.equal( streamercom.IsReceiving(), true );
            done();
        });

        it('Return closed when data receiver is closed.',function(done) {
            assert.equal( streamercom.Close(), false );
            assert.equal( streamercom.IsReceiving(), false );
            done();
        });

        it('Return data when data is received', function(done) {
            streamercom.ResetListeners();
            streamercom.Open();

            streamercom.once('datarejected', function(data) {
                done(new Error('Data rejected!'));
            });
            streamercom.once('datareceived', function(data) {
                if (_(data).isEqual(_(testdata1)) ) {                    
                    return done();
                }
                done(new Error("No matching data!"));
            });
            streamercom.emit('datasend', testdata1);
        });

        it('Return buffer empty after data is retreived', function(done) {
            streamercom.ResetListeners();
            var actual_data = streamercom.RetreiveData();
            var result = streamercom.RetreiveData();
            assert.equal( result, undefined );
            done();
        });

        it('Returned buffer must be testdata2', function(done) {
            var ondatarec = 0;
            streamercom.ResetListeners();
            streamercom.Open();

            streamercom.on('datarejected', function(data) {
                done(new Error('Data rejected!'));
            });
            streamercom.on('datareceived', function(data) {
                ondatarec++;
                if (ondatarec==2) {
                    assert.equal( _(data).isEqual(_(testdata2)), true );
                    return done();
                }
            });
            streamercom.emit('datasend', testdata1);
            streamercom.emit('datasend', testdata2);
        });

        it('When closed, returned buffer must be undefined', function(done) {
            streamercom.ResetListeners();
            streamercom.Close();

            streamercom.on('datareceived', function(data) {
                done(new Error('Data received when stream closed'));
            });

            var ondatarej = 0;
            streamercom.on('datarejected', function(data) {
                ondatarej++;
                if (ondatarej==2) {
                    return done();
                }
            });

            streamercom.emit('datasend', testdata1);
            streamercom.emit('datasend', testdata2);
        });


    });


});
