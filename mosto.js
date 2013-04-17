var fs               = require('fs'),
    mvcp_server      = require('./drivers/mvcp/mvcp-driver'), 
    playlists_driver = require('./drivers/playlists/playlists-driver'), 
    _                = require('underscore'), 
    events           = require ('events'), 
    util             = require ('util');
    
function mosto(configFile) {
    var self = this;
    
    mosto.prototype.addPlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Adding playlist " + playlist.name);
        self.playlists.push(playlist);
        console.log("mbc-mosto: [INFO] Added playlist:\nid: " + playlist.id 
                + "\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.updatePlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Updating playlist " + playlist.name);
        var i = -1;
        self.playlists.some(function(element, index, array) {
            if (element.id === playlist.id) {
                i = index;
                return true;
            }
        });
        playlist.loaded = self.playlists[i].loaded;
        self.playlists[i] = playlist;
        console.log("mbc-mosto: [INFO] Updated playlist:\nid: " + playlist.id 
                + "\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.removePlaylist = function(name) {
        console.log("mbc-mosto: [INFO] Removing playlist " + name);
        var i = -1;
        var playlist = undefined;
        self.playlists.some(function(element, index, array) {
            if (element.id === id) {
                i = index;
                playlist = element;
                return true;
            }
        });
        self.playlists.splice(i, 1);
        console.log("mbc-mosto: [INFO] Removed playlist:\nid: " + playlist.id 
                + "\nname: " + playlist.name 
                + "\nstartDate: " + playlist.startDate 
                + "\nendDate: " + playlist.endDate);
        self.orderPlaylists();
    };
    
    mosto.prototype.orderPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start ordering playlists");
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Finish ordering playlists");
        self.playPlaylists();
    };
    
    mosto.prototype.playPlaylists = function() {
        if (self.server_started) {
            console.log("mbc-mosto: [INFO] Start playing playlists");
            self.playlists.forEach(function(element, index, array) {
                if (!element.loaded) {
                    self.appendClip(element.medias);
                    element.loaded = true;
                }
            });
        } else {
            console.log("mbc-mosto: [WARNING] MVCP Server not yet started, waiting...");
        }
    };
    
    mosto.prototype.appendClip = function(clips) {
        var clip = clips.shift();
        if (clip !== undefined) {
            self.server.appendClip(clip, function() {
                console.log("mbc-mosto: [INFO] Loaded clip: " + clip.file);
                self.appendClip(clips);
            }, function(err) {
                console.error("mbc-mosto: [ERROR] Error loading clip " + clip.file + "\n" + err);
                throw err;
            });
        } else {
            self.server.play(function() {
                self.server.getServerPlaylist(function(data) {
                    console.log("Playlist loaded: ") ;
                    console.log(data);
                    self.server.getServerStatus(function(data) {
                        console.log("Currently playing: ") ;
                        console.log(data);
                    }, function (err) {
                        console.error("mbc-mosto: [ERROR] Error obtaining MVCP Server Status");
                        throw err;
                    });
                }, function(err) {
                    console.error("mbc-mosto: [ERROR] Error obtaining MVCP Server Playlist");
                    throw err;
                }); 
            }, function(err) {
                console.error("mbc-mosto: [ERROR] Error starting playback");
                throw err;
            });
        }
    };
    
    mosto.prototype.sendStatus = function() {
        //TODO: Fabricio should replace all invocations to this function with
        //real invocations.  This is just an example
        self.server.getServerStatus(function(resp1) {
            var status = resp1;
            self.server.getServerPlaylist(function(resp2) {
                var playlist = resp2;
                var st = self.buildStatus(playlist, status);
                self.emit("status", st); 
            });
        });
    };
    
    mosto.prototype.buildStatus = function(serverPlaylist, serverStatus) {
        var status = {};
        var clip = {};
        var show = {};
        
        var currentPlaylistId = serverStatus.actualClip.playlistId;
        
        var playlist = _.find(self.playlists, function(playlist) {
            return playlist.id === currentPlaylistId;
        });   
        var index = _.indexOf(self.playlists, playlist, true);
        
        var prevPlaylistId = undefined;
        if (index > 0) 
            prevPlaylistId = self.playlists[index - 1].id;
        var nextPlaylistId = undefined;
        if (index < (self.playlists.length - 1))
            nextPlaylistId = self.playlists[index + 1].id;
        
        var currentClip = serverStatus.actualClip;
        
        var prevClip = undefined;
        if (parseInt(currentClip.order) > 0) {
            prevClip = _.find(serverPlaylist, function(prevClip) {
                return parseInt(prevClip.order) === (parseInt(currentClip.order) - 1);
            });         
        }
        var nextClip = undefined;
        if (parseInt(currentClip.order) < (serverPlaylist.length - 1)) {
            nextClip = _.find(serverPlaylist, function(nextClip) {
                return parseInt(nextClip.order) === (parseInt(currentClip.order) + 1);
            }); 
        }
        
        clip.previous = prevClip;
        clip.current  = currentClip;
        clip.next     = nextClip;
        
        show.previous = prevPlaylistId;
        show.current  = currentPlaylistId;
        show.next     = nextPlaylistId;
        
        status.clip = clip;
        status.show = show;
        status.position = serverStatus.currentPos;
        status.clips = serverPlaylist;
        
//        console.log("Vuelve");
        return status;
    };

    mosto.prototype.startWatching = function() {
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile);
        fs.watch(self.configFile, function(event, filename) {
            if (event === 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            this.config = require(this.configFile);
        });
    };
    
    mosto.prototype.initDriver = function() {
        console.log("mbc-mosto: [INFO] Initializing playlists driver");
        self.driver.registerNewPlaylistListener(self.addPlaylist);
        self.driver.registerUpdatePlaylistListener(self.updatePlaylist);
        self.driver.registerRemovePlaylistListener(self.removePlaylist);
        self.driver.start();
    };
    
    mosto.prototype.startMvcpServer = function(callback) {
        var result = self.server.initServer();
        result.then(function() {
            "mbc-mosto: [INFO] MVCP server started";
            if (callback !== undefined) {
                self.server_started = true;
                callback();
            }
        }, function(err) {
            var e = new Error("mbc-mosto: [ERROR] Error starting MVCP server: " + err + ".\nRetrying in 5 seconds...");
            console.error(e);
            setTimeout(function() {
                self.startMvcpServer(self.playPlaylists);
            }, 5000);
        });
    };
    
    this.configFile     = configFile;
    this.config         = false;
    this.playlists      = [];
    this.server_started = false;
    
    if (!this.configFile)
        this.configFile = './config.json';
    
    console.log("mbc-mosto: [INFO] Reading configuration from " + this.configFile);
    
    this.config = require(this.configFile);

    this.server     = new mvcp_server(this.config.mvcp_server);
    this.driver     = new playlists_driver(this.config.playlist_server);
    
    console.log("mbc-mosto: [INFO] Starting mbc-mosto... ") ;
    
    self.startMvcpServer(self.playPlaylists);
    self.startWatching();
    self.initDriver();
    setInterval(function() {
        self.sendStatus();
    }, 1000);
    
}

exports = module.exports = function(configFile) {
    util.inherits(mosto, events.EventEmitter);
    var mosto_server = new mosto(configFile);
    return mosto_server;
};
