var moment = require('moment');

exports = module.exports = {
    getXmlFileNameFromClip: function(clip) {
        return clip.playlist_id + "$" + clip.id + ".xml";
    },

    getPlaylistIdFromXmlFileName: function(filename) {
        var aux = filename.split("$");
        if ( aux.length > 0 ) {
            filename = aux[0];
        }
        return filename;
    },

    getClipIdFromXmlFileName: function(filename) {
        // return everything between the first - and .xml
        var match = filename.match(/^[^\$]+\$(.*)\.xml$/);
        if( match ) {
            return match[1];
        }
        return filename;
    },

    getCurrentPosFromClip: function(actualFrame, totalFrames) {
        return parseFloat(actualFrame / totalFrames);
    },

    convertFramesToSeconds: function ( frames, fps ) {
        return frames/fps;
    },
};
