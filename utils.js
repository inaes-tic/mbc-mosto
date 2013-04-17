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
};