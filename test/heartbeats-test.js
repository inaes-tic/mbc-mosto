var assert      = require("assert"),
    melted      = require('../api/Melted'),
    helpers     = require('./media_helpers'), 
    Mosto       = require('../models/Mosto'),
    _           = require('underscore'),
    moment      = require('moment'),
    exec        = require('child_process').exec,
    heartbeats  = require('../heartbeats');


describe('Mosto Heartbeats Test', function() {
    before(function(done) {
        melted.take(function() {
            melted.stop(function(){
                melted.start(function(pid) {
                    melted.setup(undefined, undefined, function(has_err) {
                        Mosto.Playlists().get('playlists').reset();
                        Mosto.Playlists().save();
                        Mosto.Playlists().get('melted_medias').initMvcpServer().then(function() {
                            Mosto.Playlists().get('melted_medias').write.take(function() {
                                Mosto.Playlists().get('melted_medias').write.leave();
                                done();
                            });
                        });
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

        describe('- Suscribe and wait 1 second', function() {
            self.checkouts = 0;
            self.clipStatus = 0;
            self.startPlaying = 0;
            self.outOfSync = 0;
            self.hbErrors = 0;
            self.noClips = 0;
            self.start = [];
            self.end = [];
            before(function(done) {
                self.hb.on('forceCheckout', function() {
                    self.ckeckouts++;
                });
                self.hb.on('clipStatus', function() {
                    self.clipStatus++;
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
                self.hb.on('syncStarted', function() {
                    self.start.push(moment());
                });
                self.hb.on('syncEnded', function() {
                    self.end.push(moment());
                });
                self.hb.init();
                setTimeout(function() {
                    done();
                }, 1000);
            });
            it('-- Should have received 0 forceCheckout events', function() {
                if (self.checkouts !== 0)
                    console.warn("Received " + self.checkouts + " events");
                assert.equal(self.checkouts, 0);
            });
            it('-- Should have received > 1 clipStatus events', function() {
                console.warn("Received " + self.clipStatus + " events");
                assert.ok(self.clipStatus > 1);
            });
            it('-- Should have received 1 startPlaying events', function() {
                console.warn("Received " + self.startPlaying + " events");
                assert.equal(self.startPlaying, 1);
            });
            it('-- Should have received 1 outOfSync events', function() {
                console.warn("Received " + self.outOfSync + " events");
                assert.equal(self.outOfSync, 1);
            });
            it('-- Should have received 0 hbError events', function() {
                if (self.hbErrors !== 0)
                    console.warn("Received " + self.hbErrors + " events");
                assert.equal(self.hbErrors, 0);
            });
            it('-- Should have received > 1 noClips events', function() {
                console.warn("Received " + self.noClips + " events");
                assert.ok(self.noClips > 1);
            });
            it('-- Should have received syncStarted event', function() {
                //assert.ok(self.start > 0);
                console.log('Got', self.start.length);
                assert.ok(self.start.length > 0);
            });
            it('-- Should have received syncEnded event', function() {
                //assert.ok(self.end > 0);
                console.log('Got', self.end.length);
                assert.ok(self.end.length > 0);
            });
            it('-- Should have received more starts than ends', function() {
                assert.ok(self.start.length >= self.end.length);
            });
            it('-- Should wait 50 ms between end and start of sync', function() {
                var results = [];
                var messages = [];
                for(var i = 1 ; i < self.start.length ; i++) {
                    var millis = self.start[i] - self.end[i-1];
                    results.push(millis >= 50);
                    messages.push(i + ": Ms " + millis);
                }
                console.warn(messages.join("|"));
                assert.ok(_.all(results));
            });
        });

        after(function(done) {
            this.timeout(15000);
            self.hb.stop().then(function() {
                Mosto.Playlists().get('melted_medias').stopMvcpServer().then(function() {
                    done();
                });
            });
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
        self.startPlaying = 0;
        self.outOfSync = 0;
        self.hbErrors = 0;
        self.noClips = 0;
        self.start = 0;
        self.end = 0;

        before(function(done) {
            var config = {
                gc_interval: 5000,
                sync_interval: 50,
                min_scheduled_hours: 4,
                checkout_interval: 900,
                mvcp_server: "melted"
            };
            self.hb = new heartbeats(config);

            self.hb.on('forceCheckout', function() {
                self.checkouts++;
            });
            self.hb.on('clipStatus', function() {
                self.clipStatus++;
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
            self.hb.on('syncStarted', function() {
                if (self.start === 0 && self.end > 0)
                    self.start = moment();
            });
            self.hb.on('syncEnded', function() {
                if (self.end === 0)
                    self.end = moment();
            });
            self.hb.init();

            var mediamodels = _.map(medias, function(media, ix) { return new Mosto.Media(_.extend(media, { playlist_order: ix })); });

            var pl = createPlaylist(mediamodels);

            playlists().addPlaylist(pl);

            Mosto.Playlists().get('melted_medias').initMvcpServer().then(function() {
                Mosto.Playlists().get('melted_medias').write.take(function() {
                    Mosto.Playlists().get('melted_medias').write.leave();
                    done();
                });
            });
        });

        describe('-- Starting playback and wait 3 seconds', function() {
            before(function(done) {
                setTimeout(function() {
                    done();
                }, 3000);
            });
            it('--- Should have received at least 1 forceCheckout events', function() {
                console.warn("Received " + self.checkouts + " events");
                assert.ok(self.checkouts > 0);
            });
            it('--- Should have received > 30 clipStatus events', function() {
                console.warn("Received " + self.clipStatus + " events");
                assert.ok(self.clipStatus > 30);
            });
            it('--- Should have received 0 startPlaying events', function() {
                if (self.startPlaying !== 0)
                    console.warn("Received " + self.startPlaying + " events");
                assert.equal(self.startPlaying, 0);
            });
            it('--- Should have received 0 outOfSync events', function() {
                if (self.outOfSync !== 1)
                    console.warn("Received " + self.outOfSync + " events");
                assert.equal(self.outOfSync, 1);
            });
            it('--- Should have received 0 hbError events', function() {
                if (self.hbErrors !== 0)
                    console.warn("Received " + self.hbErrors + " events");
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                if (self.noClips !== 0)
                    console.warn("Received " + self.noClips + " events");
                assert.equal(self.noClips, 0);
                done();
            });
            it('-- Should have received syncStarted event', function() {
                assert.ok(self.start > 0);
            });
            it('-- Should have received syncEnded event', function() {
                assert.ok(self.end > 0);
            });
            it('-- Should wait 50 ms between end and start of sync', function() {
                var millis = self.start - self.end;
                console.warn("Ms " + millis);
                assert.ok(millis >= 50);
            });
        });
        describe('-- Make a goto in melted and wait 1.5 second', function() {
            before(function(done) {
                self.checkouts = 0;
                self.clipStatus = 0;
                self.startPlaying = 0;
                self.outOfSync = 0;
                self.hbErrors = 0;
                self.noClips = 0;
                exec("echo 'goto u0 500' | nc localhost 5250", function (error, stdout, stderr) {
                    setTimeout(function() {
                        done();
                    }, 1500);
                });
            });
            it('--- Should have received at least 1 forceCheckout events', function() {
                console.warn("Received " + self.checkouts + " events");
                assert.ok(self.checkouts > 0);
            });
            it('--- Should have received > 15 clipStatus events', function() {
                console.warn("Received " + self.clipStatus + " events");
                assert.ok(self.clipStatus > 15);
            });
            it('--- Should have received 0 startPlaying events', function() {
                if (self.startPlaying !== 0)
                    console.warn("Received " + self.startPlaying + " events");
                assert.equal(self.startPlaying, 0);
            });
            it('--- Should have received 1 outOfSync events', function() {
                if (self.outOfSync !== 1)
                    console.warn("Received " + self.outOfSync + " events");
                assert.equal(self.outOfSync, 1);
            });
            it('--- Should have received 0 hbError events', function() {
                if (self.hbErrors !== 0)
                    console.warn("Received " + self.hbErrors + " events");
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                if (self.noClips !== 0)
                    console.warn("Received " + self.noClips + " events");
                assert.equal(self.noClips, 0);
                done();
            });
        });
        describe('-- Pause in melted and wait 1.5 second', function() {
            before(function(done) {
                self.checkouts = 0;
                self.clipStatus = 0;
                self.startPlaying = 0;
                self.outOfSync = 0;
                self.hbErrors = 0;
                self.noClips = 0;
                exec("echo 'pause u0' | nc localhost 5250", function (error, stdout, stderr) {
                    setTimeout(function() {
                        done();
                    }, 1500);
                });
            });
            it('--- Should have received at least 1 forceCheckout events', function() {
                console.warn("Received " + self.checkouts + " events");
                assert.ok(self.checkouts > 0);
            });
            it('--- Should have received > 15 clipStatus events', function() {
                console.warn("Received " + self.clipStatus + " events");
                assert.ok(self.clipStatus > 15);
            });
            it('--- Should have received 1 startPlaying events', function() {
                if (self.startPlaying !== 1)
                    console.warn("Received " + self.startPlaying + " events");
                assert.equal(self.startPlaying, 1);
            });
            it('--- Should have received 0 outOfSync events', function() {
                if (self.outOfSync !== 0)
                    console.warn("Received " + self.outOfSync + " events");
                assert.equal(self.outOfSync, 0);
            });
            it('--- Should have received 0 hbError events', function() {
                if (self.hbErrors !== 0)
                    console.warn("Received " + self.hbErrors + " events");
                assert.equal(self.hbErrors, 0);
            });
            it('--- Should have received 0 noClips events', function(done) {
                if (self.noClips !== 0)
                    console.warn("Received " + self.noClips + " events");
                assert.equal(self.noClips, 0);
                done();
            });
        });

        after(function(done) {
            playlists().get("melted_medias").write.take(function() {
                playlists().get("melted_medias").stopMvcpServer().then(function() {
                    self.hb.stop().then(function() {
                        playlists().get("melted_medias").write.leave();
//                        melted.stop(function(){
//                            melted.start(function(pid) {
//                                melted.setup(undefined, undefined, function(has_err) {
                                    setTimeout(function() {
                                        done();
                                    }, 1000);
//                                });
//                            });
//                        });
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
