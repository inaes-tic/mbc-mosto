function Playlist(name, hash, startDate, medias, endDate) {
    this.name      = name;   
    this.hash      = hash;
    this.startDate = startDate;
    this.medias    = medias;
    this.endDate    = endDate;
}

exports = module.exports = function(name, hash, startDate, medias, endDate) {
    var playlist = new Playlist(name, hash, startDate, medias, endDate);
    return playlist;
};