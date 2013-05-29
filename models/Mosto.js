var Backbone   = require('backbone')
,   relational = require('backbone-relational')
,   config     = require('mbc-common').config.Mosto.General
,   path       = require('path')
,   uuid       = require('node-uuid')
,   _          = require('underscore')
,   moment     = require('moment')
;

var Mosto = {};


Mosto.Media = Backbone.Model.extend({
    defaults: {
        playlist_order: undefined,
        actual_order: undefined,
        name: '',
        type: 'default',
        file: undefined,
        length: undefined,
        fps: undefined,
        start: undefined,
        end: undefined,
    },
});

Mosto.BlankClip = new Mosto.Media({
    name: path.basename(config.black).replace(path.extname(config.black, '')),
    file: config.black,
    fps: config.fps,
});

Mosto.MediaCollection = Backbone.Collection.extend({
    /* this is a playlist's list of clips, it sorts by playlist_order */
    model: Mosto.Media,
    comparator: 'playlist_order',
});

Mosto.MeltedCollection = Backbone.Collection.extend({
    model: Mosto.Media,
    comparator: function(a, b) {
        /* this sorts by playlist + playlist_order */
        return (a.get('playlist').get('start') - b.get('playlist').get('start')) ||
            (a.get('playlist_order') - b.get('playlist_order'));
    },
});

Mosto.Playlist = Backbone.Model.extend({
    defaults: {
        name: null,
        start: null,   // moment
        end: null,     // moment
        mode: "snap",
        loaded: false,
        medias: null,
    },
    initialize: function (attributes, options) {
        console.log ('creating new Mosto.Playlist', attributes, options);
        this.set('name', this.get('name') || this.get('_id'));

        if( !attributes.start )
            throw new Error("Must provide a start date");
        this.set('start', moment(this.get('start')));
        if (!attributes.end )
            throw new Error("Must provide an end date");
        this.set('end', moment(this.get('end')));

        if (!attributes.medias)
            this.set('medias', new Mosto.MediaCollection());
    },
    getMedias: function() {
        return this.get('medias').toArray();
    },
});

Mosto.PlaylistCollection = Backbone.Collection.extend({
    model: Mosto.Playlist,
    comparator: 'start',
    initialize: function() {
        Backbone.Collection.prototype.initialize.apply(this, arguments);
        this.on('sorted', this.addBlanks.bind(this));
    },
    sort: function(options) {
        this.removeBlanks({ silent: true });
        Backbone.Collection.prototype.sort.apply(this);
    },
    removeBlanks: function(options) {
        /*
         * forwards `options` to `remove`
         */
        this.remove(this.where({ name: Mosto.BlankClip.get('name') }),
                    options);
    },
    addBlanks: function(collection, options) {
        for(var i=1 ; i < this.length ; i++) {
            var prev = this.at(i-1);
            var curr = this.at(i);
            var end = prev.get('end');
            var start = curr.get('start');
            if( end < start ) {
                this.addBlankPlaylist(end, start, i);
            }
        }
    },
    addBlankPlaylist: function(from, to, at) {
        var options = at && { at: at } || {};
        var blank = Mosto.BlankClip.clone();
        var duration = to - from;
        var playlist = new Playlist({
            name: blank.get('name'),
            start: from,
            end: to,
        });
        blank.set({'id': uuid.v4()});
        playlist.medias.add(blank);
        this.add(playlist, options);
    },
    getMedias: function() {
        var medias = this.map(function(playlist) { return playlist.getMedias() })
        return _.flatten(medias);
    },
});

Mosto.LoadedPlaylists = Backbone.Model.extend({
    defaults: {
        playlists: null,
        melted_medias: null,
    },

    initialize: function(attributes, options) {
        attributes = attributes || {};
        if (!attributes.playlists)
            this.set('playlists', new Mosto.PlaylistCollection());
        if (!attributes.melted_medias)
            this.set('melted_medias', new Mosto.MeltedCollection());
    },

    save: function() {
        this.get('melted_medias').set(this.get('playlists').getMedias());
    },
});

exports = module.exports = Mosto;
