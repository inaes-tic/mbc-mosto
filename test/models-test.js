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
            it("should add it's media to melted", function(done) {
                var mlt_media = self.mlt_media = self.playlists.get('melted_medias');
                var playlists = self.pls = self.playlists.get('playlists');
                var medias = self.mediamodels = _.map(self.medias, function(media, ix) { return new Mosto.Media(_.extend(media, { playlist_order: ix })) });
                var duration = _.reduce(medias, function(acc, media) { return acc + media.get('length') * media.get('fps') * 1000 }, 0);
                var now = moment();
                var pl = new Mosto.Playlist({
                    id: now.valueOf(),
                    name: 'test',
                    start: moment(now),
                    end: now.add(duration),
                });
                pl.get('medias').add(medias);
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
                it('removing the Playlist and saving should remove them from melted as well', function(done){
                    var pl = self.pls.at(0);
                    self.playlists.removePlaylist(pl);
                    self.playlists.save();
                    self.mlt_media.take(function() {
                        mvcp.getServerPlaylist().then(function(clips) {
                            clips.length.should.eql(0);
                        }).then(done, done).fin(self.mlt_media.leave);
                    });
                });
            });
        });
    });
});
