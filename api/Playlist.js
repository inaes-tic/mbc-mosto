function Playlist(name, startDate, medias, endDate, mode) {
    this.name      = name;   	
    this.startDate = startDate;
    this.medias    = medias;
    this.endDate   = endDate;
	this.mode      = mode;   
    this.loaded    = false;
}

exports = module.exports = function(name, startDate, medias, endDate, mode) {
    var playlist = new Playlist(name, startDate, medias, endDate, mode);
    return playlist;
};
