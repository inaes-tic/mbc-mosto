function Status(status, currentClip, currentPos) {
    this.status           = status;
    this.currentClip      = currentClip;
    this.currentPos       = currentPos;
}

exports = module.exports = function(status, currentClip, currentPos) {
    var st = new Status(status, currentClip, currentPos);
    return st;
};
