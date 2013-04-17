var assert = require("assert");

var mvcp_server = require('../drivers/mvcp/mvcp-driver');
var server      = new mvcp_server('melted');
var Media        = require('../api/Media.js');

describe('connect', function(){
    before(function(done) {
        var result = server.initServer();
        result.then(function() {
            done();
        }, function(err) {
            console.error("Error: " + err);
        });	
    });
    describe('#mvcp server connected', function(){
        it('--should return true', function(){
            assert.equal(server.isConnected(), true);
        });
    });
});

describe('commands', function() {
    var file1 = "../videos/SMPTE_Color_Bars_01.mp4";
    var file2 = "../videos/SMPTE_Color_Bars_02.mp4";
    var file3 = "../videos/SMPTE_Color_Bars_03.mp4";
    describe('#load', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.stop(function() {
                server.clearPlaylist(function() {
                    var clip = new Media(1, 0, undefined, 1, file1.substring(file1.lastIndexOf("/") + 1), "default", file1, "00:05:10", 25);
                    server.loadClip(clip, function() {
                        server.getServerPlaylist(function(playlist) {
                            pl = playlist;
                            server.getServerStatus(function(status) {
                                st = status;
                                done();
                            }, function(err) {
                                done();
                                console.error(err);
                            });
                        }, function(err) {
                            done();
                            console.error(err);
                        });
                    }, function(err) {
                        console.error(err);
                    }) ;
                }, function(err) {
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return stopped', function() {
            assert.equal(st.status, "stopped");
        });
    });
    describe('#play', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.play(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#append', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media(2, 1, undefined, 1, file2.substring(file1.lastIndexOf("/") + 1), "default", file2, "00:05:10", 25);
            server.appendClip(clip, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#insert', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media(3, 2, undefined, 1, file3.substring(file1.lastIndexOf("/") + 1), "default", file3, "00:05:10", 25);
            server.insertClip(clip, 1, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#move', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.moveClip(1, 2, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#remove', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.removeClip(1, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#append 2', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media(4, 3, undefined, 1, file2.substring(file1.lastIndexOf("/") + 1), "default", file2, "00:05:10", 25);
            server.appendClip(clip, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 1', function() {
            assert.equal(st.actualClip.id, 1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#goto', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.goto(1, 0, function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 1);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 3', function() {
            assert.equal(st.actualClip.id, 3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#pause', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.pause(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 1);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 3', function() {
            assert.equal(st.actualClip.id, 3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "paused");
        });
    });
    describe('#play 2', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.play(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 1);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 3', function() {
            assert.equal(st.actualClip.id, 3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#clean', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.cleanPlaylist(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 3', function() {
            assert.equal(st.actualClip.id, 3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#stop', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.stop(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
            assert.equal(st.actualClip.order, 0);
        });
        it('--Status: Clip playlist id: should return 1', function() {
            assert.equal(st.actualClip.playlistId, 1);
        });
        it('--Status: Clip id: should return 3', function() {
            assert.equal(st.actualClip.id, 3);
        });
        it('--Status: Unit status: should return stopped', function() {
            assert.equal(st.status, "stopped");
        });
    });
    describe('#clear', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.clearPlaylist(function() {
                server.getServerPlaylist(function(playlist) {
                    pl = playlist;
                    server.getServerStatus(function(status) {
                        st = status;
                        done();
                    }, function(err) {
                        done();
                        console.error(err);
                    });
                }, function(err) {
                    done();
                    console.error(err);
                });
            }, function(err) {
                console.error(err);
            }) ;
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
                var i = st.actualClip.order;
            }, function(err) {
                console.error(err);
                return err !== undefined;
            });
        });
        it('--Status: Clip id: should throw error', function() {
            assert.throws(function() {
                var i = st.actualClip.id;
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
