var assert      = require("assert");
var exec        = require('child_process').exec;
var _           = require('underscore');
var mvcp_server = require('../drivers/mvcp/mvcp-driver');
var melted      = require('../api/Melted');
var helpers     = require('./media_helpers');

function getMedia(id, orig_order, playlist_id, name, type, file, length, fps) {
    var media = {};
    media.id           = id;
    media.orig_order   = orig_order;
    media.playlist_id  = playlist_id;
    media.name         = name;
    media.type         = type;
    media.file         = file;
    media.length       = length;
    media.fps          = fps;
    return media;
}

describe('start mvcp-driver test', function(done) {

    var server = undefined;

    this.timeout(15000);

    before(function(done) {
        // Make sure we start with a fresh melted
        melted.take(function() {
            melted.stop(function(){
                done();
            });
        });
    });
    after(function(done) {
        // and leave it "clean" after we leave
        melted.stop(function() {
            melted.leave();
            done()
        });
    });

    describe('#start melted', function() {
        before(function(done) {
            melted.start(function(pid){
                done();
            });
        });
        after(function(done) {
            melted.stop(function() {
                server = undefined;
                done()
            });
        });
        it('-- mvcp server created', function(done) {
            server = mvcp_server("melted");
            assert.notEqual(server, undefined);
            done();
        });
    });

    describe("# start with melted started", function() {
        before(function(done) {
            melted.start(function() {
                server = mvcp_server("melted");
                done();
            });
        });
        after(function(done) {
            melted.stop(function() {
                done();
            });
        });

        describe('#setup melted and connect', function() {
            describe('#mvcp server connected', function(){
                it('--should return true', function(done) {
                    server.initServer();
                    melted.setup(undefined, undefined, function(has_err) {
                        // time to next server_started update.
                        setTimeout(function(){
                            assert.equal(server.isConnected(), true);
                            done();
                        }, 100);
                    });
                });
            });
        });

        describe("# start with melted set up", function() {
            before(function(done) {
                server.initServer();
                melted.setup(undefined, undefined, function(has_err) {
                    // time to next server_started update.
                    setTimeout(function(){
                        assert.equal(server.isConnected(), true);
                        done();
                    }, 100);
                });
            });

            describe('commands', function() {
                var file1 = "../videos/Bars-1600.xml";
                var file2 = "../videos/Bars-3200.xml";
                var file3 = "../videos/Bars-6400.xml";
                describe('#load', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        var clip = getMedia(1, 0, 1, file1.substring(file1.lastIndexOf("/") + 1), "default", file1, 1600, 25);
                        //            server.stop().then(server.clearPlaylist()).then(server.loadClip(clip)).then(function() {
                        //                return server.getServerPlaylist().then(function(playlist) {
                        //                    pl = playlist;
                        //                });
                        //            }).then(function() {
                        //                return server.getServerStatus().then(function(status) {
                        //                    st = status;
                        //                });
                        //            }).fail(function(err) {
                        //                console.error(err);
                        //            }).fin(function() {
                        //                done();
                        //            });
                        server.stop().then(function() {
                            return server.clearPlaylist().then(function() {
                                return server.loadClip(clip).then(function() {
                                    return server.getServerPlaylist().then(function(playlist) {
                                        pl = playlist;
                                    });
                                }).then(function() {
                                    return server.getServerStatus().then(function(status) {
                                        st = status;
                                    });
                                })})
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 1', function() {
                        assert.equal(pl.length, 1);
                    });
                    it('--List: Clip index: should return 0', function() {
                        assert.equal(pl[0].order, 0);
                    });
                    it('--List: Clip playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return stopped', function() {
                        assert.equal(st.status, "stopped");
                    });
                });
                describe('#play', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.play().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 1', function() {
                        assert.equal(pl.length, 1);
                    });
                    it('--List: Clip index: should return 0', function() {
                        assert.equal(pl[0].order, 0);
                    });
                    it('--List: Clip playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#append', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        var clip = getMedia(2, 1, 1, file2.substring(file1.lastIndexOf("/") + 1), "default", file2, 3200, 25);
                        server.appendClip(clip).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 2', function() {
                        assert.equal(pl.length, 2);
                    });
                    it('--List: Clip index: should return 1', function() {
                        assert.equal(pl[1].order, 1);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 2', function() {
                        assert.equal(pl[1].id, 2);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#insert', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        var clip = getMedia(3, 2, 1, file3.substring(file1.lastIndexOf("/") + 1), "default", file3, 6400, 25);
                        server.insertClip(clip, 1).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 2', function() {
                        assert.equal(pl[2].id, 2);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#move', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.moveClip(1, 2).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 2', function() {
                        assert.equal(pl[1].id, 2);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 3', function() {
                        assert.equal(pl[2].id, 3);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#remove', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.removeClip(1).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 2', function() {
                        assert.equal(pl.length, 2);
                    });
                    it('--List: Clip index: should return 1', function() {
                        assert.equal(pl[1].order, 1);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#append 2', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        var clip = getMedia(4, 3, 1, file2.substring(file1.lastIndexOf("/") + 1), "default", file2, 3200, 25);
                        server.appendClip(clip).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 4', function() {
                        assert.equal(pl[2].id, 4);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 1', function() {
                        assert.equal(st.currentClip.id, 1);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#goto', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.goto(1, 0).then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 4', function() {
                        assert.equal(pl[2].id, 4);
                    });
                    it('--Status: Clip order: should return 1', function() {
                        assert.equal(st.currentClip.order, 1);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 3', function() {
                        assert.equal(st.currentClip.id, 3);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#pause', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.pause().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 4', function() {
                        assert.equal(pl[2].id, 4);
                    });
                    it('--Status: Clip order: should return 1', function() {
                        assert.equal(st.currentClip.order, 1);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 3', function() {
                        assert.equal(st.currentClip.id, 3);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "paused");
                    });
                });
                describe('#play 2', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.play().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 3', function() {
                        assert.equal(pl.length, 3);
                    });
                    it('--List: Clip index: should return 2', function() {
                        assert.equal(pl[2].order, 2);
                    });
                    it('--List: Clip 1 playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip 1 id: should return 1', function() {
                        assert.equal(pl[0].id, 1);
                    });
                    it('--List: Clip 2 playlist id: should return 1', function() {
                        assert.equal(pl[1].playlistId, 1);
                    });
                    it('--List: Clip 2 id: should return 3', function() {
                        assert.equal(pl[1].id, 3);
                    });
                    it('--List: Clip 3 playlist id: should return 1', function() {
                        assert.equal(pl[2].playlistId, 1);
                    });
                    it('--List: Clip 3 id: should return 4', function() {
                        assert.equal(pl[2].id, 4);
                    });
                    it('--Status: Clip order: should return 1', function() {
                        assert.equal(st.currentClip.order, 1);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 3', function() {
                        assert.equal(st.currentClip.id, 3);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#clean', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.cleanPlaylist().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 1', function() {
                        assert.equal(pl.length, 1);
                    });
                    it('--List: Clip index: should return 0', function() {
                        assert.equal(pl[0].order, 0);
                    });
                    it('--List: Clip playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip id: should return 3', function() {
                        assert.equal(pl[0].id, 3);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 3', function() {
                        assert.equal(st.currentClip.id, 3);
                    });
                    it('--Status: Unit status: should return playing', function() {
                        assert.equal(st.status, "playing");
                    });
                });
                describe('#stop', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.stop().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 1', function() {
                        assert.equal(pl.length, 1);
                    });
                    it('--List: Clip index: should return 0', function() {
                        assert.equal(pl[0].order, 0);
                    });
                    it('--List: Clip playlist id: should return 1', function() {
                        assert.equal(pl[0].playlistId, 1);
                    });
                    it('--List: Clip id: should return 3', function() {
                        assert.equal(pl[0].id, 3);
                    });
                    it('--Status: Clip order: should return 0', function() {
                        assert.equal(st.currentClip.order, 0);
                    });
                    it('--Status: Clip playlist id: should return 1', function() {
                        assert.equal(st.currentClip.playlistId, 1);
                    });
                    it('--Status: Clip id: should return 3', function() {
                        assert.equal(st.currentClip.id, 3);
                    });
                    it('--Status: Unit status: should return stopped', function() {
                        assert.equal(st.status, "stopped");
                    });
                });
                describe('#clear', function() {
                    var pl = undefined;
                    var st = undefined;
                    before(function(done) {
                        server.clearPlaylist().then(function() {
                            return server.getServerPlaylist().then(function(playlist) {
                                pl = playlist;
                            });
                        }).then(function() {
                            return server.getServerStatus().then(function(status) {
                                st = status;
                            });
                        }).fail(function(err) {
                            console.error(err);
                        }).fin(function() {
                            done();
                        });
                    });
                    it('--List: Clips loaded: should return 0', function() {
                        assert.equal(pl.length, 0);
                    });
                    it('--List: Clip index: should throw error', function() {
                        assert.throws(function() {
                            var i = pl[0].order;
                        }, function(err) {
                            console.error(err);
                            return err !== undefined;
                        });
                    });
                    it('--List: Clip id: should throw error', function() {
                        assert.throws(function() {
                            var i = pl[0].id;
                        }, function(err) {
                            console.error(err);
                            return err !== undefined;
                        });
                    });
                    it('--Status: Clip index: should throw error', function() {
                        assert.throws(function() {
                            var i = st.currentClip.order;
                        }, function(err) {
                            console.error(err);
                            return err !== undefined;
                        });
                    });
                    it('--Status: Clip id: should throw error', function() {
                        assert.throws(function() {
                            var i = st.currentClip.id;
                        }, function(err) {
                            console.error(err);
                            return err !== undefined;
                        });
                    });
                    it('--Status: Unit status: should return stopped', function() {
                        assert.equal(st.status, "stopped");
                    });
                });
            });
            describe('make sure appends all happen in the right order', function() {
                var files = ["../videos/Bars-1600.xml",
                             "../videos/Bars-3200.xml",
                             "../videos/Bars-6400.xml"];
                it('', function(done) {
                    var n = 100;
                    var list = _.draw(files, n);
                    var count = 0;
                    var good = _.after(n, function() {
                        done();
                    });
                    list.forEach(function(f, i) {
                        var clip = getMedia(i, 0, 1, f.substring(f.lastIndexOf("/") + 1),
                                             "default", f, 1600, 25);
                        server.appendClip(clip).then(function() {
                            assert.equal(count, i);
                            count++;
                        }).then(good).done();
                    });
                });
            });
        });
    });
});
