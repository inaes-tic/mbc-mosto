function Playlist(name, start, medias, end) {
    this.name      = name;   
    this.start     = start;
    this.medias    = medias;
    this.end       = end;
    this.loaded    = false;
}

exports = module.exports = function(name, start, medias, end) {
    var playlist = new Playlist(name, start, medias, end);
    return playlist;
};
