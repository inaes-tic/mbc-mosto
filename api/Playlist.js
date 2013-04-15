function Playlist(id, name, startDate, medias, endDate) {
    this.id        = id;
    this.name      = name;   
    this.startDate = startDate;
    this.medias    = medias;
    this.endDate   = endDate;
    this.loaded    = false;
}

exports = module.exports = function(id, name, startDate, medias, endDate) {
    var playlist = new Playlist(id, name, startDate, medias, endDate);
    return playlist;
};