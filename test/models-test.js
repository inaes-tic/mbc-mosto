var Mosto   = require('../models/Mosto')
,   should  = require('should')
,   mvcp    = require('../drivers/mvcp/mvcp-driver')('melted')
,   melted  = require('../api/Melted')
,   helpers = require('./media_helpers')
,   _       = require('underscore')
,   moment  = require('moment')
;

describe.only('models.Mosto', function() {
    var self = this;
    self.playlists = Mosto.Playlists;
    self.medias = helpers.getMedia();
    this.timeout(300000);

    self.createPlaylist = function(medias, start) {
        var duration = _.reduce(medias, function(acc, m) { return acc + m.get('length') * m.get('fps') }, 0);
        start = start || moment();
        var pl = new Mosto.Playlist({
            id: now.valueOf(),
            name: 'test',
            start: moment(now),
            end: now.add(duration),
        });
        pl.get('medias').add(medias);
        return pl;
    };

    describe('MeltedCollection', function(){
        before(function(done) {
            // restart melted
            melted.take(function() {
                melted.stop(function() {
                    melted.start(function() {
                        melted.setup(undefined, undefined, function() {
                            done()
                        });
                    });
                });
            });
        });

        after(function(done) {
            melted.stop(function() {
                melted.leave();
                done();
            });
        });

        describe("Media juggling", function() {
            before(function() {
                self.mlt_media = self.playlists.get('melted_medias');
                self.pls = self.playlists.get('playlists');
                self.mediamodels = _.map(self.medias, function(media, ix) { return new Mosto.Media(_.extend(media, { playlist_order: ix })) });
            });
            describe("starting without medias in melted", function(){
                beforeEach(function(done) {
                    self.mlt_media.take(function() {
                        mvcp.cleanPlaylist().then(function(){ done() }, done).fin(self.mlt_media.leave);
                    });
                });
                afterEach(function(done) {
                    self.pls.set([]);
                    self.playlists.save();
                    self.mlt_media.take(function() {
                        done();
                        self.mlt_media.leave()
                    });
                });
                it("should add it's media to melted", function(done) {
                    var mlt_media = self.mlt_media;
                    var playlists = self.pls;
                    var pl = self.createPlaylist(self.mediamodels);

                    self.playlists.addPlaylist(pl);
                    self.playlists.save();
                    mlt_media.take(function() {
                        mvcp.getServerPlaylist().then(function(clips) {
                            clips.length.should.eql(self.medias.length);
                            clips.forEach(function(clip, ix) {
                                clip.id.should.eql(self.medias[ix].id);
                            });
                        }).then(done, done).fin(mlt_media.leave);
                    });
                });
            });
            describe("starting with media in melted", function() {
                beforeEach(function(done) {
                    var pl = self.createPlaylist(self.mediamodels);
                    self.pls.set(pl);
                    self.playlists.save();
                    self.mlt_media.take(function() {
                        done();
                        self.mlt_media.leave()
                    });
                });
                afterEach(function(done) {
                    self.pls.set([]);
                    self.playlists.save();
                    self.mlt_media.take(function() {
                        done();
                        self.mlt_media.leave()
                    });
                });
                it('A new instance should fetch the playlist from the server', function(done){
                    var mm = new Mosto.MeltedCollection();
                    mm.fetch();
                    mm.take(function() {
                        mm.length.should.eql(self.medias.length);
                        done();
                    });
                });

                describe('remove medias', function() {
                    it('medias removed directly from MeltedCollection should be removed from melted', function(done) {
                        var collection = self.mlt_media;
                        collection.remove(self.mediamodels);
                        collection.take(function() {
                            mvcp.getServerPlaylist().then(function(clips) {
                                clips.length.should.eql(0);
                            }).then(done, done).fin(collection.leave);
                        });
                    });
                    it('but when Playlists.save(), they should be restored', function(done){
                        self.playlists.save();
                        self.mlt_media.take(function(){
                            mvcp.getServerPlaylist().then(function(clips) {
                                clips.length.should.eql(self.medias.length);
                                clips.forEach(function(clip, ix) {
                                    clip.id.should.eql(self.medias[ix].id);
                                });
                            }).then(done, done).fin(self.mlt_media.leave);
                        });
                    });
                    });
                });
            });
        });
    });
});
