var melted_node = require('melted-node'),
    melted_xml  = require('node-mlt'),
    fs          = require('fs'),
    yaml        = require('yaml'),
    sys         = require('sys'),
    exec        = require('child_process').exec;
    
function mosto(configFile) {
    var self = this;
    
    mosto.prototype.startPlaylistsWatch = function() {
        console.log("mbc-mosto: [INFO] Start watching playlists dir " + self.config.playlists.base) ;
        fs.watch(self.config.playlists.base, function(event, filename) {
            self.readPlaylists();
        });
    }
    
    mosto.prototype.readConfig = function(callback) {
        console.log("mbc-mosto: [INFO] Reading configuration from " + self.configFile);
        var fileContents = fs.readFileSync(self.configFile);
        if (!fileContents) 
            throw new Error("mbc-mosto: [ERROR] Couldnt read config file " + self.configFile);
        self.config = yaml.eval(fileContents.toString());
        callback();
    };

    mosto.prototype.readPlaylists = function() {
        console.log("mbc-mosto: [INFO] Start reading playlists from " + self.config.playlists.base)
        aux = fs.readdirSync(self.config.playlists.base);
        aux.forEach(function(element, index, array){
            var fileContents = fs.readFileSync(self.config.playlists.base + "/" + element);
            if (!fileContents) {
                //TODO: do it better
                console.error("mbc-mosto: [ERROR] Couldnt read playlist file " + element);
            } else {
                console.log("mbc-mosto: [INFO] Reading playlist: " + element);
                var playlist = yaml.eval(fileContents.toString());
                eval("playlist.name='" + element + "'");
                console.log("mbc-mosto: [INFO] Adding playlist:");
                console.log(playlist);
                self.playlists.push(playlist);
            }
            self.orderPlaylist();
        });
    }
    
    mosto.prototype.orderPlaylist = function() {
        console.log("mbc-mosto: [INFO] Start ordering playlists:");
        console.log(self.playlists);
        self.playlists.sort(function (item1, item2) {
            if (item1.startDate < item2.startDate)
                return -1;
            else if (item1.startDate > item2.startDate)
                return 1;
            else
                return 0;
        });
        console.log("mbc-mosto: [INFO] Ordered playlists:");
        console.log(self.playlists);
        self.playlists.forEach(function(element, index, array){
           self.playPlaylist(element); 
        });
    }

    mosto.prototype.playPlaylist = function(playlist) {
        console.log("mbc-mosto: [INFO] Preparing xml for playlist " + playlist.name);
        playlist.files.forEach(function(element, index, array){
            var xml = new melted_xml();
            
            var type;
            var file;
            if (typeof element === 'string') {
                type = self.config.types.defecto;
                file = element;
            } else {
                type = element.type;
                file = element.file;
            }
            var filters = self.config.types[type].filters;
            
            console.log("mbc-mosto: [INFO] Adding file " + file);
            var video = new melted_xml.Producer.Video({source: file});
            xml.push(video);
            
            var pl = new melted_xml.Playlist;
            pl.entry({producer: video});
            xml.push(pl);

            var track = new melted_xml.Multitrack.Track(pl);

            var multitrack = new melted_xml.Multitrack;
            multitrack.addTrack(track);

            var tractor = new melted_xml.Tractor; 
            tractor.push(multitrack);
            
            filters.forEach(function(element, index, array){
                var filter = self.config.filters[element];
                var filterObj = new melted_xml.Filter[filter.filter.charAt(0).toUpperCase() + filter.filter.slice(1)](filter.properties);
                console.log("mbc-mosto: [INFO] Adding filter " + filter.filter);
                console.log(filter.properties);
                tractor.push(filterObj);
            });

            xml.push(tractor);
            
            var fileName = file.substring(file.lastIndexOf("/") + 1);
            var xmlFile = self.config.playlists.xml + "/" + fileName + ".xml";
            
            console.log("mbc-mosto: [INFO] Writig file " + xmlFile);
            fs.writeFile(xmlFile, xml.toString({pretty:true}), function(err){
                if (err) {
                    console.error("mbc-mosto: [ERROR] " + err.toString());
                    return;
                } else {
                    console.log("mbc-mosto: [INFO] File ready: " + xmlFile + " at " + playlist.startDate)
                    self.sendXml(xmlFile)
                    //self.scheduleFile(xmlFile, playlist.startDate);
                }
            });
        });
    }
    
    mosto.prototype.scheduleFile = function(xmlFile, date) {
        var hours   = date.getHours();
        var minutes = date.getMinutes();
        var seconds = date.getSeconds();
        var day     = date.getDay();
        var month   = date.getMonth();
        var year    = date.getFullYear();
        
        month++;
        
        /*if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}*/

        exec("at " + hours + ":" + minutes + " " + month + "-" + day + "-" + year + " " + " echo '" + xmlFile + "' >> " + self.config.playlists.go, function(error, stdout, stderr){
            sys.print('stdout: ' + stdout);
            sys.print('stderr: ' + stderr);
            if (error !== null) 
                console.log("mbc-mosto: [ERROR] Error scheduling file " + xmlFile + " for date " + date.toString() + ": " + error); 
        });
    }
    
    mosto.prototype.sendXml = function(xmlFile) {
        console.log('mbc-mosto: [INFO] Sending file ' + xmlFile);
        self.mlt.sendCommand("apnd u0 " + xmlFile, "200 OK");
        self.mlt.sendCommand("play u0", "200 OK");    
    }
    
    mosto.prototype.startWatching = function() {
        console.log("mbc-mosto: [INFO] Start watching config file " + self.configFile) ;
        fs.watch(self.configFile, function(event, filename) {
            if (event == 'rename')
                throw new Error("mbc-mosto: [ERROR] Config file renaming is not supported");
            self.readConfig();
        });

        self.startPlaylistsWatch();
        self.readPlaylists();
    }
    
    mosto.prototype.startMeltedServer = function() {
        var result = self.mlt.connect();
        result.then(function() {
            self.startWatching();
        });
    }
    
    this.configFile = configFile;
    this.config     = false;
    this.playlists  = [];
    this.mlt = new melted_node();
    
    if (!this.configFile)
        this.configFile = "mosto-config.yml";
    
    self.readConfig(self.startMeltedServer);
    
}

exports = module.exports = function(configFile) {
    var mosto_server = new mosto(configFile);
    return mosto_server;
}
var mosto_server = new mosto();