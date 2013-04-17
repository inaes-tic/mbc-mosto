function Status(status, actualClip, currentPos) {
    this.status           = status;
    this.actualClip       = actualClip;
    this.currentPos       = currentPos;
}

exports = module.exports = function(status, actualClip, currentPos) {
    var st = new Status(status, actualClip, currentPos);
    return st;
};
