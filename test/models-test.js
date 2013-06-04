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

        it("should add it's media to melted", function(done) {
            var mlt_media = self.playlists.get('melted_medias');
            var playlists = self.playlists.get('playlists');
            var medias = [new Mosto.Media(self.medias[0]), new Mosto.Media(self.medias[1])];
            var duration = _.reduce(medias, function(acc, media) { return acc + media.get('length') * media.get('fps') * 1000 }, 0);
            var now = moment();
            var pl = new Mosto.Playlist({
                id: now.valueOf(),
                name: 'test',
                start: now,
                end: now + duration,
            });
            pl.get('medias').add(medias);
            self.playlists.addPlaylist(pl);
            self.playlists.save();
            mlt_media.take(function() {
                mvcp.getServerPlaylist().then(function(clips) {
                    clips.length.should.eql(2);
                }).then(done, done).fin(mlt_media.leave);
            });
        });

        it('A new instance should fetch the playlist from the server', function(done){
            var mm = new Mosto.MeltedCollection();
            mm.fetch();
            mm.take(function() {
                mm.length.should.eql(2);
                done();
            });
        });
    });
});
