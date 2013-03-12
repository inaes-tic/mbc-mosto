var melted_node = require('melted-node'),
    melted_xml  = require('node-mlt'), 
    Playlist    = require('../../api/Playlist'),
    Media       = require('../../api/Media'),
    fs          = require('fs'), 
    config      = require('./conf/melted-node-driver');
    
function melted(host, port) {
    var self = this;
    console.log("mbc-mosto: [INFO] Creating server instance [" + host + ":" + port + "]")
    this.mlt = new melted_node(host, port);
    console.log("mbc-mosto: [INFO] Server instance created [" + this.mlt.host + ":" + this.mlt.port + "]")
    
    melted.prototype.playPlaylist = function(playlist, callback) {
        console.log("mbc-mosto: [INFO] Preparing xml for playlist " + playlist.name);
        var xmlFiles = [];
        playlist.medias.forEach(function(element, index, array){
            var xml = new melted_xml();
            
            var type = element.type;
            var file = element.file;

//            var filters = self.config.types[type].filters;
            
            console.log("mbc-mosto: [INFO] Adding file " + file);
            var video = new melted_xml.Producer.Video({source: file});
            xml.push(video);
            
            console.log("mbc-mosto: [INFO] Creating playlist xml object for file " + file);
            var pl = new melted_xml.Playlist;
            pl.entry({producer: video});
            xml.push(pl);

            console.log("mbc-mosto: [INFO] Creating track xml object for file " + file);
            var track = new melted_xml.Multitrack.Track(pl);

            console.log("mbc-mosto: [INFO] Creating multitrack xml object for file " + file);
            var multitrack = new melted_xml.Multitrack;
            multitrack.addTrack(track);

            console.log("mbc-mosto: [INFO] Creating tractor xml object for file " + file);
            var tractor = new melted_xml.Tractor; 
            tractor.push(multitrack);
            
//            console.log("mbc-mosto: [INFO] Creating filter xml objects for file " + file);
//            console.log("mbc-mosto: [INFO] Filters: " + filters);
//            filters.forEach(function(element, index, array){
//                var filter = self.config.filters[element];
//                var filterObj = new melted_xml.Filter[filter.filter.charAt(0).toUpperCase() + filter.filter.slice(1)](filter.properties);
//                console.log("mbc-mosto: [INFO] Adding filter " + filter.filter);
//                console.log(filter.properties);
//                tractor.push(filterObj);
//            });

            console.log("mbc-mosto: [INFO] Pushing xml for file " + file);
            xml.push(tractor);
            
            var fileName = file.substring(file.lastIndexOf("/") + 1);
            var xmlFile = config.playlists_xml_dir + "/" + fileName + ".xml";
            xmlFiles.push(xmlFile);
            
            console.log("mbc-mosto: [INFO] Writing file " + xmlFile);
            fs.writeFile(xmlFile, xml.toString({pretty:true}), function(err){
                if (err) {
                    console.error("mbc-mosto: [ERROR] " + err.toString());
                    return;
                } else {
                    console.log("mbc-mosto: [INFO] File ready: " + xmlFile + " at " + playlist.startDate);
                    if (index === (array.length - 1))
                        self.sendFiles(xmlFiles, callback);
                }
            });
        });
    };
    
    melted.prototype.sendFiles = function(xmlFiles, callback) {
        console.log("mbc-mosto: [INFO] Received files: " + xmlFiles);        
        var xmlFile = xmlFiles.shift();
        if (xmlFile !== undefined) {
            console.log('mbc-mosto: [INFO] Sending file ' + xmlFile);
            self.mlt.sendCommand("apnd u0 " + xmlFile, "200 OK", function() {
                self.mlt.sendCommand("play u0", "200 OK", function() {
                    self.sendFiles(xmlFiles, callback);
                }, function(error) {
                    var err = new Error("mbc-mosto: [ERROR] Error playing u0 for file: " + xmlFile + " [" + error + "]");
                    console.error(err);
                    throw err;
                });
            }, function(error) {
                var err = new Error("mbc-mosto: [ERROR] Error appending u0 for file: " + xmlFile + " [" + error + "]");
                console.error(err);
                throw err;
            });
        } else {
            console.log('mbc-mosto: [INFO] Finish sending files');
            if (callback !== undefined) {
                console.log('mbc-mosto: [INFO] Calling callback function');
                callback();
            }
        }
    };
    
    melted.prototype.getServerPlaylist = function(successCallback, errorCallback) {
            self.mlt.sendCommand("list u0", "201 OK", function(response) {
                // HACK: Converting the promise object to a string :)
                var data = "." + response;
                
                var split = data.split("\r\n");
                var JSONresponse = {};
                JSONresponse.medias = [];
                for (var i = 2; i < split.length; i++) {
                    var line = split[i];
                    if (line.length > 5) {
                        var media = {};
                        var parse = line.split(" ");
                        media.index       = parse[0];
                        media.file        = parse[1];
                        media.in          = parse[2];
                        media.out         = parse[3];
                        media.real_length = parse[4];
                        media.calc_length = parse[5];
                        media.fps         = parse[6]
                        JSONresponse.medias.push(media);
                    }
                }
//                var aux = JSON.stringify(JSONresponse, null, 4);                
//                console.log("Esto volvio:");
//                console.log(aux);
                successCallback(JSONresponse);
            }, function(error) {
                var err = new Error("mbc-mosto: [ERROR] Error getting server playlist: " + error)
                console.error(err);
                errorCallback(err);
            });
    };
    
    melted.prototype.getServerStatus = function(successCallback, errorCallback) {
            self.mlt.sendCommand("usta u0", "202 OK", function(response) {
                // HACK: Converting the promise object to a string :)
                var data = "." + response;
                
                var split = data.split("\r\n");
                var media = {};
                
                var parse = split[1].split(" ");
                media.file         = parse[2];
                media.currentFrame = parse[3];
                media.fps          = parse[5];
                media.in           = parse[6];
                media.out          = parse[7];
                media.length       = parse[8];
                media.index        = parse[16]
                successCallback(media);
            }, function(error) {
                var err = new Error("mbc-mosto: [ERROR] Error getting server status: " + error)
                console.error(err);
                errorCallback(err);
            });
    };
    
    melted.prototype.initServer = function() {
        console.log("mbc-mosto: [INFO] Connecting to server instance [" + self.mlt.host + ":" + self.mlt.port + "]");
        var result = self.mlt.connect();
        return result;
    };
    
}

exports = module.exports = function(host, port) {
    var melted_node_driver = new melted(host, port);
    return melted_node_driver;
};

