function Media(id, orig_order, actual_order, playlist_id, name, type, file, length, fps) {
    this.id           = id;
    this.orig_order   = orig_order;
    this.actual_order = actual_order;
    this.playlist_id  = playlist_id;
    this.name         = name;
    this.type         = type;
    this.file         = file;
    this.length       = length;
    this.fps          = fps;
}

exports = module.exports = function(id, orig_order, actual_order, playlist_id, name, type, file, length, fps) {
    var media = new Media(id, orig_order, actual_order, playlist_id, name, type, file, length, fps);
    return media;
};