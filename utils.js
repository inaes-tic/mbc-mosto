function utils() {
    utils.prototype.getXmlFileNameFromClip = function(clip) {
        return clip.playlist_id + "-" + clip.id + ".xml";
    };
    
    utils.prototype.getPlaylistIdFromXmlFileName = function(filename) {
        return filename.split("-")[0];
    };

    utils.prototype.getClipIdFromXmlFileName = function(filename) {
        return filename.split("-")[1];
    };
    
}

exports = module.exports = function() {
    var util = new utils();
    return util;
};