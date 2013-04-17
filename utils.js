exports = module.exports = {
    getXmlFileNameFromClip: function(clip) {
        return clip.playlist_id + "-" + clip.id + ".xml";
    },
    
    getPlaylistIdFromXmlFileName: function(filename) {
        return filename.split("-")[0];
    },

    getClipIdFromXmlFileName: function(filename) {
        var aux = filename.split("-")[1];
        return aux.substring(0, aux.length - 5);
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