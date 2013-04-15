exports = module.exports = {
    getXmlFileNameFromClip: function(clip) {
        return clip.playlist_id + "-" + clip.id + ".xml";
    },
    
    getPlaylistIdFromXmlFileName: function(filename) {
        return filename.split("-")[0];
    },

    getClipIdFromXmlFileName: function(filename) {
        return filename.split("-")[1];
    }    
};