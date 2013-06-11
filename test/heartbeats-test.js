var assert      = require("assert"),
    melted      = require('../api/Melted'),
    helpers     = require('./media_helpers'), 
    Mosto       = require('../models/Mosto'),
    _           = require('underscore'),
    moment      = require('moment'),
    exec        = require('child_process').exec,
    heartbeats  = require('../heartbeats');


describe.only('Mosto Heartbeats Test', function(done) {
    before(function(done) {
        melted.take(function() {
            melted.stop(function(){
                melted.start(function(pid) {
                    melted.setup(undefined, undefined, function(has_err) {                    
                        done();                    
                    });
                });
            });
        });
    });
    
    describe('#Heartbeats: Init with custom config and without medias', function() {
        var self = this;
        self.hb = undefined;
        before(function(done) {
            var config = {
                gc_interval: 5000,
                sync_interval: 50,
                min_scheduled: 1000,
                mvcp_server: "melted"
            };
            self.hb = new heartbeats(config);
            done();
        });
        
        describe('- Suscribe and wait 1.1 second', function() {
            self.checkouts = 0;
            self.clipStatus = 0;
            self.frameStatus = 0;
            self.startPlaying = 0;
            self.outOfSync = 0;
            self.hbErrors = 0;
            self.noClips = 0;
            before(function(done) {
                self.hb.on('forceCheckout', function() {
                    self.ckeckouts++;
                });
                self.hb.on('clipStatus', function() {
                    self.clipStatus++;
                });
                self.hb.on('frameStatus', function() {
                    self.frameStatus++;
                });
                self.hb.on('startPlaying', function() {
                    self.startPlaying++;
                });
                self.hb.on('outOfSync', function() {
                    self.outOfSync++;
                });
                self.hb.on('hbErrors', function() {
                    self.hbErrors++;
                });
                self.hb.on('noClips', function() {
                    self.noClips++;
                });
                self.hb.init();
                setTimeout(function() {
                    done();
                }, 1100);
            });
            it('-- Should have received 0 forceCheckout events', function() {
                assert.equal(self.checkouts, 0);
            });
            it('-- Should have received 0 clipStatus events', function() {
                assert.equal(self.clipStatus, 0);
            });
            it('-- Should have received 0 frameStatus events', function() {
                assert.equal(self.frameStatus, 0);
            });
            it('-- Should have received 0 startPlaying events', function() {
                assert.equal(self.startPlaying, 0);
            });
            it('-- Should have received 0 outOfSync events', function() {
                assert.equal(self.outOfSync, 0);
            });
            it('-- Should have received 0 hbError events', function() {
                assert.equal(self.hbErrors, 0);
            });
            it('-- Should have received > 10 noClips events', function() {
                assert.ok(self.noClips > 10);
            });
        });
        
        after(function(done) {
            self.hb.stop();
            done();
        });
    });

    describe('#Heartbeats: Init with custom config and with medias', function() {
        var self = this;
        self.hb = undefined;

        var playlists = Mosto.Playlists;
        var medias = helpers.getMedia();

        createPlaylist = function(medias, start) {
            var duration = _.reduce(medias, function(acc, m) { return acc + m.get('length') * m.get('fps'); }, 0);
            start = start || moment();
            var pl = new Mosto.Playlist({
                id: start.valueOf(),
                name: 'test',
                start: moment(start),
                end: start.add(duration)
            });
            pl.get('medias').add(medias);
            return pl;
        };

        self.checkouts = 0;
        self.clipStatus = 0;
        self.frameStatus = 0;
        self.startPlaying = 0;
        self.outOfSync = 0;
        self.hbErrors = 0;
        self.noClips = 0;

        before(function(done) {
            var config = {
                gc_interval: 5000,
                sync_interval: 50,
                min_scheduled: 1000 * 60 * 60 * 4,
                checkout_interval: 900,
                mvcp_server: "melted"
            };
            self.hb = new heartbeats(config);

            self.hb.on('forceCheckout', function() {
                console.error("Received FORCECHECKOUT");
                self.checkouts++;
            });
            self.hb.on('clipStatus', function() {
                console.error("Received CLIPSTATUS");
                self.clipStatus++;
            });
            self.hb.on('frameStatus', function() {
                console.error("Received FRAMESTATUS");
                self.frameStatus++;
            });
            self.hb.on('startPlaying', function() {
                console.error("Received STARTPLAYING");
                self.startPlaying++;
            });
            self.hb.on('outOfSync', function() {
                console.error("Received OUTOFSYNC");
                self.outOfSync++;
            });
            self.hb.on('hbErrors', function() {
                console.error("Received HBERROR");
                self.hbErrors++;
            });
            self.hb.on('noClips', function() {
                console.error("Received NOCLIPS");
                self.noClips++;
            });
            self.hb.init();

            var mediamodels = _.map(medias, function(media, ix) { return new Mosto.Media(_.extend(media, { playlist_order: ix })); });

            var pl = createPlaylist(mediamodels);
            
            playlists().addPlaylist(pl);
            playlists().save();

            done();
        });
        
        describe('-- Starting playback and wait 2 seconds', function() {
            before(function(done) {
                setTimeout(function() {
                    done();
                }, 2150);
            });
            it('--- Should have received 2 forceCheckout events', function() {
                assert.equal(self.checkouts, 2);
            });
            it('--- Should have received 1 clipStatus events', function() {
                assert.equal(self.clipStatus, 1);
            });
            it('--- Should have received > 10 frameStatus events', function() {
                assert.ok(self.frameStatus > 10);
            });
            it('--- Should have received 1 startPlaying events', function() {
                assert.equal(self.startPlaying, 1);
            });
            it('--- Should have received 1 outOfSync events', function() {
                assert.equal(self.outOfSync, 1);
            });
            it('--- Should have received 0 hbError events', function() {
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                assert.equal(self.noClips, 0);
                done();
            });
        });
        describe('-- Make a goto in melted and wait 1 second', function() {
            before(function(done) {
                self.checkouts = 0;
                self.clipStatus = 0;
                self.frameStatus = 0;
                self.startPlaying = 0;
                self.outOfSync = 0;
                self.hbErrors = 0;
                self.noClips = 0;
                exec("echo 'goto u0 500' | nc localhost 5250", function (error, stdout, stderr) {
                    setTimeout(function() {
                        done();
                    }, 1000);
                });
            });
            it('--- Should have received 1 forceCheckout events', function() {
                assert.equal(self.checkouts, 1);
            });
            it('--- Should have received 0 clipStatus events', function() {
                assert.equal(self.clipStatus, 0);
            });
            it('--- Should have received > 5 frameStatus events', function() {
                assert.ok(self.frameStatus > 5);
            });
            it('--- Should have received 0 startPlaying events', function() {
                assert.equal(self.startPlaying, 0);
            });
            it('--- Should have received 1 outOfSync events', function() {
                assert.equal(self.outOfSync, 1);
            });
            it('--- Should have received 0 hbError events', function() {
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                assert.equal(self.noClips, 0);
                done();
            });
        });
        describe('-- Pause in melted and wait 1.7 second', function() {
            before(function(done) {
                self.checkouts = 0;
                self.clipStatus = 0;
                self.frameStatus = 0;
                self.startPlaying = 0;
                self.outOfSync = 0;
                self.hbErrors = 0;
                self.noClips = 0;
                exec("echo 'pause u0' | nc localhost 5250", function (error, stdout, stderr) {
                    setTimeout(function() {
                        done();
                    }, 1700);
                });
            });
            it('--- Should have received 2 forceCheckout events', function() {
                assert.equal(self.checkouts, 2);
            });
            it('--- Should have received 0 clipStatus events', function() {
                assert.equal(self.clipStatus, 0);
            });
            it('--- Should have received > 5 frameStatus events', function() {
                assert.ok(self.frameStatus > 5);
            });
            it('--- Should have received 1 startPlaying events', function() {
                assert.equal(self.startPlaying, 1);
            });
            it('--- Should have received 1 outOfSync events', function() {
                assert.equal(self.outOfSync, 1);
            });
            it('--- Should have received 0 hbError events', function() {
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                assert.equal(self.noClips, 0);
                done();
            });
        });
        
        after(function(done) {
            self.hb.stop();
            melted.stop(function(){
                melted.start(function(pid) {
                    melted.setup(undefined, undefined, function(has_err) {                    
                        done();                    
                    });
                });
            });
        });
    });

    describe('#leave melted', function() {
        it('-- leave melted', function(done) {
            melted.stop(function(pid) {
                melted.leave();
                done();
            });
        });
    });

});