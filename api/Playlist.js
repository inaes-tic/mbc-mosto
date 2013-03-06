function Playlist(name, startDate, medias) {
    this.name      = name;    
    this.startDate = startDate;
    this.medias    = medias;
}

exports = module.exports = function(name, startDate, medias) {
    var playlist = new Playlist(name, startDate, medias);
    return playlist;
};