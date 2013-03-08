function Playlist(name, hash, startDate, medias) {
    this.name      = name;   
    this.hash      = hash;
    this.startDate = startDate;
    this.medias    = medias;
}

exports = module.exports = function(name, hash, startDate, medias) {
    var playlist = new Playlist(name, hash, startDate, medias);
    return playlist;
};