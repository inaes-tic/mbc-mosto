var assert = require('assert');
var should = require('should');
var fs = require('fs');
var mosto = require('../mosto');
var melted = require('melted-node');
var _ = require('underscore');
var seed = require('seed-random');
var mbc = require('mbc-common');
var Media = require('mbc-common/models/Media');
var Q = require('q');

_.mixin({
    shuffleSeed: function(list, s) {
        seed(s, true);
        var ret = _.shuffle(list);
        seed(undefined, true);
    },
    randint: function(x, y, s) {
        var from = 0;
        var to = 0;
        if( y === undefined )
            to = x;
        else {
            from = x;
            to = y;
        }
        var width = to - from;
        return (parseInt(seed(s)() * width) + from)
    },
    randelem: function(list) {
        return list[_.randint(list.length)];
    },
    draw: function(list, n) {
        var ret = [];
        for(var i = 0 ; i < n ; i++) {
            ret.push(_.randelem(list));
        }
        return ret;
    },
});

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
        var mediamodels = [];
        medias.forEach(function(media) {
            mediamodels.push( Media.Piece(media) );
        });
        return Media.List({
            collection: mediamodels,
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
        var done = _.after(self.playlists.length, defer.resolve);
        var occcol = self.db.collection('scheds');
        var listcol = self.db.collection('lists');
        for( var i = 0 ; i < self.playlists.length ; i++ ) {
            var playlist = self.playlists[i];
            var occurrence = {
                start: timewalk.unix(),
            };
            for( var j = 0 ; j < playlist.medias.length ; j++ ) {
                var media = playlist.medias[j];
                media.start_time = timewalk.valueOf();
                timewalk.add(playlist.medias[j].length);
                media.end_time = timewalk.valueOf();
            }
            occurrence.end = timewalk.unix();
            listcol.insert(playlist, function(err, obj) {
                obj = obj[0];
                occurrence = Media.Ocurrence({
                    list: obj._id,
                    start: occurrence.start,
                    end: occurrence.end
                });
                occcol.insert(occurrence, function(err, obj) {
                    self.occurrences.push(obj[0]);
                    done();
                });
            });
        }
        return defer.promise;
    };
    self.clean_playlists = function(done) {
        // Cleans the playlists and occurrences from the database
        var ready = _.after(2, function(){ done(); });
        self.db.collection('scheds').drop(ready);
        self.db.collection('lists').drop(ready);
    }

    self.get_playlist = function(time) {
        time = time || moment();
        return _.find(self.playlists, function(pl) {
            return pl.start <= time.unix() && pl.end >= time.unix();
        });
    };

    self.get_media = function(time) {
        time = time || moment;
        var playlist = self.get_playlist(time);

        return _.find(playlist.medias, function(me) {
            return me.start_time <= time && me.end_time >= time;
        });
    };

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
                console.log(result);
                result = result.split('\r\n')[1].split(' ');
                var file = result[2];
                file.should.include('black_id');
            }).then(done, done);
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
            // I assume all non-hidden files are videos
            self.medias = _.reject(fs.readdirSync('./test/videos'), function(el){ return el[0] == '.' });
            // self.medias = parseXMLs(self.medias);
            self.medias = [];
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
            it('should start the right clip');
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
