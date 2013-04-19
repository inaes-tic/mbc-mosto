exports = module.exports = {
    getXmlFileNameFromClip: function(clip) {
        return clip.playlist_id + "-" + clip.id + ".xml";
    },
    
    getPlaylistIdFromXmlFileName: function(filename) {
        var aux = filename.split("-");
        if ( aux.length > 0 ) {
            filename = aux[0];
		}
		return filename;
    },

    getClipIdFromXmlFileName: function(filename) {
        var aux = filename.split("-");
        if ( aux.length > 1 ) {
            aux = aux[1];            
            filename = aux.substring(0, aux.length - 5);
        }
        return filename;      
    },
            
    getTimeLengthFromFrames: function(frames, fps) {
        var seconds = parseFloat(frames) / parseFloat(fps);
        var minutes = 0;
        if (seconds > 60) {
            minutes = parseInt(seconds / 60);
            seconds = parseInt (seconds - (minutes * 60));
        }
        var hours = 0;
        if (minutes > 60) {
            hours = parseInt(hours / 60);
            minutes = parseInt(minutes - (hours * 60));
        }
        return "." + hours + ":" + minutes + ":" + seconds;
    },
    
    getCurrentPosFromClip: function(actualFrame, totalFrames) {
        return parseFloat(actualFrame / totalFrames);
    }
};