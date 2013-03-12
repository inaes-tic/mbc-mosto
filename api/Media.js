function Media(type, file, length, fps) {
    this.type   = type;
    this.file   = file;
    this.length = length;
    this.fps    = fps;
}

exports = module.exports = function(type, file, length, fps) {
    var media = new Media(type, file, length, fps);
    return media;
};