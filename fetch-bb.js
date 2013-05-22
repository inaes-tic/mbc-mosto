var events         = require('events')
,   util           = require('util')
,   PlaylistDriver = require('./drivers/playlist/playlist-driver')
,   Mosto          = require('./models/Mosto')
;

function Fetch() {
    events.EventEmitter.call(this);

    this.driver = PlaylistDriver();
    this.driver.on('create', this.addPlaylist.bind(this));
    this.driver.on('update', this.updatePlaylist.bind(this));
    this.driver.on('delete', this.removePlaylist.bind(this));

    this.playlists = new Mosto.Collection();
    this.playlists.on('add', this.onCollectionUpdated.bind(this));
}

util.inherits(Fetch, events.EventEmitter);

Fetch.prototype.addPlaylist = function(playlist) {
    this.playlists.add(playlist, { merge: true });
};

Fetch.prototype.updatePlaylist = function(playlist) {
    // check if we need to remove it
    var existing = this.playlists.findWhere({ _id: playlist.get("_id")});
    if( existing && (playlist.get('start') > this.time_window.end ||
                     playlist.get('end') < this.time_window.start)) {
        return this.removePlaylist(playlist.get('_id'));
    }

    // if we didn't need to remove it, add it. addPlaylist calls with merge: true
    return this.addPlaylist(playlist);
};

Fetch.prototype.removePlaylist = function(id) {
};

Fetch.prototype.onCollectionUpdated = function() {
};
