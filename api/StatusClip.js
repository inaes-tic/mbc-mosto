function StatusClip(id, order, playlistId) {
    this.id         = id;
    this.order      = order;
    this.playlistId = playlistId;
}

exports = module.exports = function(id, order, playlistId) {
    var clip = new StatusClip(id, order, playlistId);
    return clip;
};