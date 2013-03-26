function Playlist(name, startDate, medias, endDate) {
    this.name      = name;   
    this.startDate = startDate;
    this.medias    = medias;
    this.endDate   = endDate;
    this.loaded    = false;
}

exports = module.exports = function(name, startDate, medias, endDate) {
    var playlist = new Playlist(name, startDate, medias, endDate);
    return playlist;
};