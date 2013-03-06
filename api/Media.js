function Media(type, file) {
    this.type = type;
    this.file = file;
}

exports = module.exports = function(type, file) {
    var media = new Media(type, file);
    return media;
};