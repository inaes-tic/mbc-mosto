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
};

Fetch.prototype.updatePlaylist = function(playlist) {
};

Fetch.prototype.removePlaylist = function(id) {
};

Fetch.prototype.onCollectionUpdated = function() {
};
