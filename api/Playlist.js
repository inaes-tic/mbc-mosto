var moment = require('moment');

function Playlist(id, name, startDate, medias, endDate, mode) {
    this.id        = id;
    this.name      = name;
    this.start     = moment(startDate);
    this.medias    = medias;
    this.end       = moment(endDate);
    this.mode      = mode;
    this.loaded    = false;
}

exports = module.exports = function(id, name, startDate, medias, endDate, mode) {
    var playlist = new Playlist(id, name, startDate, medias, endDate, mode);
    return playlist;
};
