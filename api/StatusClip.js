function StatusClip(id, order, playlistId, fps, currentFrame, totalFrames) {
    this.id           = id;
    this.order        = order;
    this.playlistId   = playlistId;
    this.fps          = fps;
    this.currentFrame = currentFrame;
    this.totalFrames  = totalFrames;
}

exports = module.exports = function(id, order, playlistId, fps, currentFrame, totalFrames) {
    var clip = new StatusClip(id, order, playlistId, fps, currentFrame, totalFrames);
    return clip;
};