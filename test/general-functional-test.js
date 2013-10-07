var assert = require('assert');
var should = require('should');
var fs     = require('fs');
var mosto  = require('../mosto');
var melted = require('melted-node');
var _      = require('underscore');
var seed   = require('seed-random');
var mbc    = require('mbc-common');
var Media  = require('mbc-common/models/Media');
var Q      = require('q');
var moment = require('moment');
var helper = require('./media_helpers.js');
var uuid   = require('node-uuid');
var mosto_config = require('mbc-common').config.Mosto.General;

describe.skip("Mosto functional test", function() {
    /*
     * arrancar sin playlists
     ** ver negro
     */
    this.timeout(60000);
    var self = this;
    // use a random seed
    self.start_seed = seed()();
    self.rand = seed(self.start_seed);

    self.create_playlist = function(medias) {
        medias = medias || [];
        var mediamodels = [];
        medias.forEach(function(media) {
            mediamodels.push( new Media.Piece(media.toJSON()) );
        });
        return new Media.List({
            models: mediamodels
        });
    };

    self.setup_playlists = function(start_time) {
        /*
         * sets up playlists to be consecutive starting from start_time
         * and annotates the medias to keep track of start and end times
         *
         * returns a promise
         */
        var timewalk = moment(start_time);
        self.occurrences = [];
        var defer = Q.defer();
        var done = _.after(self.playlists.length, function(){
            defer.resolve();
        });
        var occcol = self.db.collection('scheds');
        var listcol = self.db.collection('lists');
        var log = [];
        for( var i = 0 ; i < self.playlists.length ; i++ ) {
            var playlist = self.playlists[i];
            var occurrence = {
                start: timewalk.unix()
            };
            log.push(i+':');
            log.push('occurrence.start: ' + occurrence.start);
            var medias = playlist.get('collection');
            for( var j = 0 ; j < medias.length ; j++ ) {
                var media = medias.at(j);
                media.start_time = timewalk.valueOf();
                log.push('media ' + j + ' id      :' + media.get('_id'));
                log.push('media ' + j + ' start   : ' + media.start_time);
                timewalk.add(helper.mediaLengthToMilliseconds(
                    media.get('durationraw')));
                media.end_time = timewalk.valueOf();
                log.push('media ' + j + ' end     : ' + media.end_time);
            }
            occurrence.end = timewalk.unix();
            log.push('occurrence.end  : ' + occurrence.end);
            var playlist_json = _.omit(playlist.toJSON(), 'collection');
            playlist_json.models = _.invoke(playlist_json.models, 'toJSON');
            playlist_json._id = uuid.v4();
            log.forEach(function(l) {
                console.log('[setup_playlists]:', l) ;
            });
            console.log('[setup_playlists] final:', playlist_json);
            // I need to wrap this in order to keep the `playlist` variable
            (function(pl, oc) {
                listcol.insert(playlist_json, function(err, obj) {
                    obj = obj[0];
                    // update self.playlists
                    _.extend(pl, obj);
                    occurrence = new Media.Occurrence({
                        list: obj._id,
                        start: oc.start,
                        end: oc.end,
                        _id: oc.start.toString(),
                    });
                    occcol.insert(occurrence.toJSON(), function(err, obj) {
                        var obj = obj[0];
                        self.occurrences.push(obj);
                        done();
                    });
                });
            })(playlist, occurrence);
        }
        return defer.promise;
    };

    self.clean_playlists = function() {
        var defer = Q.defer();
        // Cleans the playlists and occurrences from the database
        var ready = _.after(2, function(){ defer.resolve(); });
        self.db.collection('scheds').drop(ready);
        self.db.collection('lists').drop(ready);
        return defer.promise;
    };

    self.delete_occurrence = function(occurrence) {
        var defer = Q.defer();
        var occurrences = self.db.collection('scheds');
        occurrences.remove({ _id: occurrence._id }, function(err, obj) {
            self.listener.once('message', function(chan, msg) {
                if( chan === 'schedbackend.delete' ) {
                    self.listener.unsubscribe('schedbackend.delete');
                    defer.resolve();
                }
            });
            self.listener.subscribe('schedbackend.delete');
            self.publisher.publishJSON('schedbackend.delete', { model: occurrence });
        });
        return defer.promise;
    };

    self.move_occurrence = function(occurrence, delta) {
        var defer = Q.defer();
        occurrence.start += delta / 1000;
        occurrence.end += delta / 1000;
        var occurrences = self.db.collection('scheds');
        occurrences.save(occurrence, function(err, res) {
            self.listener.once('message', function(chan, msg) {
                if( chan === 'schedbackend.update' ) {
                    self.listener.unsubscribe('schedbackend.update');
                    defer.resolve();
                }
            });
            self.listener.subscribe('schedbackend.update');
            self.publisher.publishJSON('schedbackend.update', { model: occurrence });
        });
        return defer.promise;
    };

    self.get_occurrence = function(time) {
        time = time || moment();
        return _.find(self.occurrences, function(pl) {
            return pl.start <= time.unix() && pl.end >= time.unix();
        });
    };

    self.get_playlist = function(time) {
        time = time || moment();
        var occurrence = self.get_occurrence(time);
        return _.find(self.playlists, function(pl) {
            return pl._id === occurrence.list;
        });
    };

    self.get_media = function(time) {
        time = time || moment();
        var playlist = self.get_playlist(time);

        return _.find(playlist.get('models'), function(me) {
            return me.start_time <= time && me.end_time >= time;
        });
    };

    self.publisher = mbc.pubsub();
    self.listener = mbc.pubsub();
    self.db = mbc.db();

    /* generic tests */
    self.is_synced = function(done) {
        var result = self.melted.sendCommand('USTA U0').then(function(val) {
            var time = moment();
            var expected_media = self.get_media(time);
            console.log('[is_synced] time:', time.valueOf());
            console.log('[is_synced] expected media', expected_media.get('_id'));

            var lines = val.split("\r\n");
            lines[0].should.eql('202 OK');
            var splitted = lines[1].split(' ');
            var frame = parseInt(splitted[3]);
            var fps = parseInt(splitted[5]);
            var elapsed = helper.framesToMilliseconds(frame, fps);
            var expected = (time - expected_media.start_time).valueOf();
            console.log('[is_synced] got', lines[1], 'at', frame, ':', elapsed, 'expected', expected);
            elapsed.should.be.approximately(expected, 1000);
            done();
        });
        return result;
    };

    before(function() {
        self.melted = melted();
    });
    after(function() {
        delete self.melted;
    });
    describe('start without playlists', function() {
        before(function(done) {
            self.db.dropDatabase(function(err, success) {
                self.mosto = new mosto();
                self.mosto.once('playing', function() {
                    done();
                });
                self.mosto.init();
            });
        });
        after(function(done) {
            self.melted.disconnect().then(function() {
                self.mosto.finish(function() {
                    delete self.mosto;
                    done();
                });
            });
        });
        it('should show black', function(done) {
            var promise = self.melted.sendCommand('USTA U0');
            promise.then(function(result) {
                result = result.split('\r\n')[1].split(' ');
                var file = result[2];
                file.should.include('black_id');
            }).then(done).done();
        });
    });
    /*
     * arrancar con playlists
     ** ver que haya el play correspondiente
     ** ver que este en el frame correcto
     */
    describe('start with playlists', function() {
        self.playlist_count = _.randint(5, 10, self.rand());
        before(function() {
            self.medias = helper.getMBCMedia();
            self.playlists = [];
            for(var i = 0 ; i < self.playlist_count ; i++) {
                var playlist_length = _.randint(1, 10, self.rand());
                self.playlists.push(self.create_playlist(
                    _.draw(self.medias, playlist_length)));
            }
        });
        after(function() {
            delete self.playlists;
        });
        describe('starting now', function() {
            //TODO: Failing because unit status is not loaded...
            before(function(done) {
                self.db.dropDatabase(function(err, success) {
                    // let playlists start somewhere between now and 30
                    //  seconds ago
                    var setup = self.setup_playlists(moment(
                        moment() + _.randint(0, -30000)));
                    setup.then(function() {
                        self.mosto = new mosto();
                        self.mosto.once('playing', function() {
                            // send pubsub messages with new playlists
                            self.melted.connect().then(done);
                        });
                        self.mosto.init();
                    });
                });
            });
            after(function(done) {
                self.mosto.finish(function() {
                    delete self.mosto;
                    self.clean_playlists().then(done).done();
                });
            });
            it('should start the right clip', function(done) {
                var time = moment();
                var expected_occurrence = self.get_occurrence(time);
                var expected_media = self.get_media(time);

                var result = self.melted.sendPromisedCommand('USTA U0', '202 OK');
                result.then(function(val) {
                    var lines = val.split("\r\n");
                    lines[0].should.eql('202 OK');
                    var filename = lines[1].split(' ')[2];
                    filename.match(expected_occurrence._id + '-' + expected_media.get('_id')).should.be.ok;
                }).then(done).done();
            });
            it('should start on the right frame (within the second)', function(done){
                var result = self.is_synced(1000);
                result.then(done).done();
            });
            /*
            ** borrar la playlist
            *** ver que no se rompa nada
            *** ver que se este pasando negro
            */
            describe('delete currently playing playlist', function() {
                before(function(done) {
                    var occurrence = self.get_occurrence();
                    self.delete_occurrence(occurrence).then(function() {
                        setTimeout(function() {
                            self.mosto.once('status', function(status) {
                                done();
                            });
                        }, mosto_config.timer_interval);
                    }).done();
                });
                it('should not break');
                it('should be playing blank clip', function(done) {
                    var promise = self.melted.sendCommand('USTA U0');
                    promise.then(function(result) {
                        result = result.split('\r\n')[1].split(' ');
                        var file = result[2];
                        file.should.include('black_id');
                    }).then(done).done();
                });
            });
        });
        /*
         * arrancar un playlist empezado hace 5m
         */
        describe('starting 5m ago', function() {
            before(function(done) {
                self.db.dropDatabase(function(err, success) {
                    // Create a playlist that is at least 10 minutes long
                    var length = 0;
                    self._playlists = self.playlists;
                    var medias = [];
                    while(length < 10 * 60 * 1000) {
                        var media = _.randelem(self.medias);

                        length += helper.mediaLengthToMilliseconds(
                            media.get('durationraw'));
                        medias.push(media);
                    }
                    self.playlists = [self.create_playlist(medias)];
                    var setup = self.setup_playlists(moment(
                        moment() - 5 * 60 * 1000));
                    setup.then(function() {
                        self.mosto = new mosto();
                        self.mosto.once('playing', function() {
                            // send pubsub messages with new playlists
                            done();
                        });
                        self.mosto.init();
                    });
                });
            });
            after(function(done) {
                self.playlists = self._playlists;
                delete self._playlists;
                self.mosto.finish(function() {
                    delete self.mosto;
                    self.clean_playlists().then(done).done();
                });
            });
            /*
            ** ver que el frame se mantenga sincronizado durante 10 segundos
            */
            it("should keep sync'ed for at least 10 secs", function(done) {
                var timer = setInterval(function() {
                    self.is_synced(100).fail(function(err){
                        clearInterval(timer);
                        throw err;
                    });
                }, 10);
                setTimeout(function() {
                    clearInterval(timer);
                    done();
                }, 10000);
            });
            /*
            ** mover la playlist hacia atras 1m
            *** ver que el frame se sincronice correctamente
            */
            describe('move playlist back', function() {
                before(function(done) {
                    var occurrence = self.get_occurrence();
                    self.move_occurrence(occurrence, -60000).then(function(){
                        setTimeout(function() {
                            self.mosto.once('status', function(status) {
                                done();
                            });
                        }, mosto_config.timer_interval + 10);
                    }).done();
                });
                it("should stay sync'ed", function(done) {
                    self.is_synced(1000).then(done).done();
                });
            });
            /*
            ** mover la playlist hacia adelante 2m
            *** ver que el frame se sincronice correctamente
            */
            describe('move playlist forward', function() {
                it("should stay sync'ed");
            });
        });
    });
    /*
     * pruebas de timespan
     */
    describe('timespan tests', function() {
        /*
        ** levantar mosto con una ventana de 1m de ancho
        ** que haya una playlist de 2m empezando now
        ** que haya otra playlist de 30s empezando t+2m
        ** que haya otra playlist de 30s empezando en t+2m30s
        ** al start chequear que solo este la 1er playlist
        ** al 1m05 chequear que la 2da playlist este cargada
        */
        describe("start mosto with a 2m timeSpan", function() {
            it('should have a 2m timeSpan');
            describe('playlists longer than timespan', function() {
                describe('start with these [playlists:[clips]]: [3m:[1m, 1m, 1m], 1m:[30s, 30s], 1m:[1m]]', function() {
                    it('should start with a 3m playlist starting now');
                    it('should start with a playlist 1m long starting in t+3m');
                    it('should start with a playlist 1m long starting in t+4m');
                    describe('at startup', function() {
                        it('should load only the first playlist at start');
                    });
                    describe('after 1m05s', function() {
                        it('should have loaded the 2nd playlist');
                    });
                });
            });
            describe('clips longer than timespan', function() {
                describe('start with these [playlists:[clips]]: [3m:[3m], 1m[30s, 30s], 1m:[1m]]', function() {
                    it('should preload at least one clip');
                });
            });
        });
    });
    /*
     * idem anterior con una playlist de un solo clip
     ** si tengo un clip (playlist?) mas largo que la ventana, deberia haber n+1 cargados
     */
    describe("modify melted test", function() {
        it("should rectify things");
    });
});
