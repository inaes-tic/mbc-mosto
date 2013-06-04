function StatusClip(id, order, playlistId, fps, currentFrame, totalFrames) {
    this.id           = id;
    this.order        = parseInt(order);
    this.playlistId   = playlistId;
    this.fps          = parseFloat(fps);
    this.currentFrame = parseInt(currentFrame);
    this.totalFrames  = parseInt(totalFrames);
}

exports = module.exports = function(id, order, playlistId, fps, currentFrame, totalFrames) {
    var clip = new StatusClip(id, order, playlistId, fps, currentFrame, totalFrames);
    return clip;
};
