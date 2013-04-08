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
            assert.equal(server.server.mlt.connected, true);
        });
    });
});

describe('commands', function() {
    var file1 = "../videos/SMPTE_Color_Bars_01.mp4";
    var file2 = "../videos/SMPTE_Color_Bars_02.mp4";
    var file3 = "../videos/SMPTE_Color_Bars_03.mp4";
    var fileName1 = file1.substring(file1.lastIndexOf("/") + 1) + ".xml";
    var fileName2 = file2.substring(file2.lastIndexOf("/") + 1) + ".xml";
    var fileName3 = file3.substring(file3.lastIndexOf("/") + 1) + ".xml";
    describe('#load', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.stop(function() {
                server.clearPlaylist(function() {
                    var clip = new Media("default", file1, "00:05:10", 25);
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
            assert.equal(pl.medias.length, 1);
        });
        it('--List: Clip index: should return 0', function() {
            assert.equal(pl.medias[0].index, 0);
        });
        it('--List: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
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
            assert.equal(pl.medias.length, 1);
        });
        it('--List: Clip index: should return 0', function() {
            assert.equal(pl.medias[0].index, 0);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#append', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media("default", file2, "00:05:10", 25);
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
            assert.equal(pl.medias.length, 2);
        });
        it('--List: Clip index: should return 1', function() {
            assert.equal(pl.medias[1].index, 1);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#insert', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media("default", file3, "00:05:10", 25);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 3 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--List: Clip 3 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
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
            assert.equal(pl.medias.length, 2);
        });
        it('--List: Clip index: should return 1', function() {
            assert.equal(pl.medias[1].index, 1);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    describe('#append 2', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            var clip = new Media("default", file2, "00:05:10", 25);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 3 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName1, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName1);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 3 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 1', function() {
            assert.equal(st.index, 1);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 3 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 1', function() {
            assert.equal(st.index, 1);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
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
            assert.equal(pl.medias.length, 3);
        });
        it('--List: Clip index: should return 2', function() {
            assert.equal(pl.medias[2].index, 2);
        });
        it('--List: Clip 1 filename: should return ' + fileName1, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName1);
        });
        it('--List: Clip 2 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 3 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[2].file.substring(pl.medias[2].file.lastIndexOf("/") + 1, pl.medias[2].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 1', function() {
            assert.equal(st.index, 1);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });
    /*describe('#wipe', function() {
        var pl = undefined;
        var st = undefined;
        before(function(done) {
            server.wipePlaylist(function() {
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
            assert.equal(pl.medias.length, 2);
        });
        it('--List: Clip index: should return 0', function() {
            assert.equal(pl.medias[0].index, 0);
        });
        it('--List: Clip 1 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--List: Clip 2 filename: should return ' + fileName2, function() {
            var fileNameAux = pl.medias[1].file.substring(pl.medias[1].file.lastIndexOf("/") + 1, pl.medias[1].file.length -1);
            assert.equal(fileNameAux, fileName2);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Unit status: should return playing', function() {
            assert.equal(st.status, "playing");
        });
    });*/
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
            assert.equal(pl.medias.length, 1);
        });
        it('--List: Clip index: should return 0', function() {
            assert.equal(pl.medias[0].index, 0);
        });
        it('--List: Clip 1 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
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
            assert.equal(pl.medias.length, 1);
        });
        it('--List: Clip index: should return 0', function() {
            assert.equal(pl.medias[0].index, 0);
        });
        it('--List: Clip 1 filename: should return ' + fileName3, function() {
            var fileNameAux = pl.medias[0].file.substring(pl.medias[0].file.lastIndexOf("/") + 1, pl.medias[0].file.length -1);
            assert.equal(fileNameAux, fileName3);
        });
        it('--Status: Clip index: should return 0', function() {
            assert.equal(st.index, 0);
        });
        it('--Status: Clip filename: should return ' + fileName3, function() {
            var fileNameAux = st.file.substring(st.file.lastIndexOf("/") + 1, st.file.length -1);
            assert.equal(fileNameAux, fileName3);
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
            assert.equal(pl.medias.length, 0);
        });
        it('--List: Clip index: should throw error', function() {
            assert.throws(pl.medias[0], function(err) {
                console.error(err);
                return err !== undefined;
            });
        });
        it('--List: Clip 1 filename: should throw error', function() {
            assert.throws(pl.medias[0], function(err) {
                console.error(err);
                return err !== undefined;
            });
        });
        it('--Status: Clip index: should throw error', function() {
            assert.throws(st.index, function(err) {
                console.error(err);
                return err !== undefined;
            });
        });
        it('--Status: Clip filename: should throw error', function() {
            assert.throws(st.file, function(err) {
                console.error(err);
                return err !== undefined;
            });
        });
        it('--Status: Unit status: should return stopped', function() {
            assert.equal(st.status, "stopped");
        });
    });
});
