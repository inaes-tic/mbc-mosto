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

describe.only("Mosto functional test", function() {
    /*
     * arrancar sin playlists
     ** ver negro
     */
    this.timeout(5000);
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
            models: mediamodels,
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
            defer.resolve()
        });
        var occcol = self.db.collection('scheds');
        var listcol = self.db.collection('lists');
        for( var i = 0 ; i < self.playlists.length ; i++ ) {
            var playlist = self.playlists[i];
            var occurrence = {
                start: timewalk.unix(),
            };
            var medias = playlist.get('collection');
            for( var j = 0 ; j < medias.length ; j++ ) {
                var media = medias.at(j);
                media.start_time = timewalk.valueOf();
                timewalk.add(helper.framesToMilliseconds(
                    media.get('durationraw'), media.get('fps')));
                media.end_time = timewalk.valueOf();
            }
            occurrence.end = timewalk.unix();
            var playlist_json = _.omit(playlist.toJSON(), 'collection');
            playlist_json.models = _.invoke(playlist_json.models, 'toJSON');
            // I need to wrap this in order to keep the `playlist` variable
            (function(pl, oc) {
                listcol.insert(playlist_json, function(err, obj) {
                    console.log("BBBBBBBBBBBBBBB", err, obj);
                    obj = obj[0];
                    obj._id = idToString(obj._id);
                    // update self.playlists
                    _.extend(pl, obj);
                    occurrence = new Media.Occurrence({
                        list: obj._id,
                        start: oc.start,
                        end: oc.end
                    });
                    occcol.insert(occurrence.toJSON(), function(err, obj) {
                        var obj = obj[0];
                        obj._id = idToString(obj._id);
                        self.occurrences.push(obj);
                        done();
                    });
                });
            })(playlist, occurrence);
        }
        return defer.promise;
    };
    self.clean_playlists = function(done) {
        // Cleans the playlists and occurrences from the database
        var ready = _.after(2, function(){ done(); });
        self.db.collection('scheds').drop(ready);
        self.db.collection('lists').drop(ready);
    }

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
            return pl._id == occurrence.list;
        });
    };

    self.get_media = function(time) {
        time = time || moment();
        var playlist = self.get_playlist(time);

        return _.find(playlist.get('models'), function(me) {
            return me.start_time <= time && me.end_time >= time;
        });
    };

    function idToString(id) {
        return (id.toHexString && id.toHexString()) || id;
    }

    self.publisher = mbc.pubsub();
    self.listener = mbc.pubsub();
    self.db = mbc.db();

    before(function() {
        self.melted = melted();
    });
    after(function() {
        delete self.melted;
    });
    describe('start without playlists', function() {
        before(function(done) {
            self.mosto = new mosto();
            self.mosto.once('playing', function() {
                done()});
            self.mosto.init();
        });
        after(function(done) {
            self.mosto.finish(function() {
                delete self.mosto;
                done();
            });
        });
        it('should show black', function(done) {
            var promise = self.melted.sendPromisedCommand('USTA U0', '202 OK');
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
        describe('starting now', function() {
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
                            done();
                        });
                        self.mosto.init();
                    });
                });
            });
            after(function(done) {
                self.mosto.finish(function() {
                    delete self.mosto;
                    self.clean_playlists(done);
                });
            });
            it('should start the right clip', function(done) {
                var result = self.melted.sendPromisedCommand('USTA U0', '202 OK');
                var time = moment();
                var expected_occurrence = self.get_occurrence(time);
                var expected_media = self.get_media(time);
                result.then(function(val) {
                    var lines = val.split("\r\n");
                    lines[0].should.eql('202 OK');
                    var filename = lines[1].split(' ')[2];
                    filename.match(expected_occurrence._id + '-' + expected_media.get('_id')).should.be.ok;
                }).then(done, done);
            });
            it('should start on the right frame');
            /*
            ** borrar la playlist
            *** ver que no se rompa nada
            *** ver que se este pasando negro
            */
            describe('delete currently playing playlist', function() {
                it('should not break');
                it('should be playing blank clip');
            });
        });
        /*
         * arrancar un playlist empezado hace 5m
         */
        describe('starting 5m ago', function() {
            /*
            ** ver que el frame se mantenga sincronizado durante 10 segundos
            */
            it("should keep sync'ed for at least 10 secs");
            /*
            ** mover la playlist hacia atras 1m
            *** ver que el frame se sincronice correctamente
            */
            describe('move playlist back', function() {
                it("should stay sync'ed");
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
