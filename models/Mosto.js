var Backbone   = require('backbone')
,   relational = require('backbone-relational')
,   config     = require('mbc-common').config.Mosto.General
,   path       = require('path')
,   uuid       = require('node-uuid')
,   _          = require('underscore')
,   moment     = require('moment')
;

var Mosto = {};

Mosto.Media = Backbone.RelationalModel.extend({
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
})

Mosto.MediaCollection = Backbone.Collection.extend({
    /* this is a playlist's list of clips */
    model: Mosto.Media,
    comparator: function(model) {
        return model.get('playlist_order');
    },
});

Mosto.Playlist = Backbone.RelationalModel.extend({
    defaults: {
        name: null,
        start: null,   // moment
        end: null,     // moment
        mode: "snap",
        loaded: false,
    },
    relations:[{
        type: Backbone.HasMany,
        key: 'medias',
        relatedModel: Mosto.Media,
        collectionType: Mosto.MediaCollection,
        reverseRelation: {
            key: 'playlist'
        },
    }],
    initialize: function (attributes, options) {
        console.log ('creating new Mosto.Playlist', attributes, options);
        Backbone.Model.prototype.initialize.apply(this, attributes, options);
        this.set('name', this.get('name') || this.get('_id'));

        if( !attributes.start )
            throw new Error("Must provide a start date");
        this.set('start', moment(this.get('start')));
        if (!attributes.end )
            throw new Error("Must provide an end date");
        this.set('end', moment(this.get('end')));
    },
});

Mosto.PlaylistCollection = Backbone.Collection.extend({
    model: Mosto.Playlist,
    comparator: function(playlist) {
        // remember, comparator is called only on insert, update doesn't re-sort
        //  but .add(.., {merge: true}) DOES re-sort!
        return playlist.get("start");
    },
    initialize: function() {
        this.on('sorted', this.addBlanks.bind(this));
    },
    sort: function(options) {
        this.removeBlanks({ silent: true });
        Backbone.Collection.sort.apply(this);
    },
    removeBlanks: function(options) {
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
});

Mosto.LoadedPlaylists = Backbone.RelationalModel.extend({
    relations: [{
        type: Backbone.HasMany,
        key: 'playlists',
        relatedModel: Mosto.Playlist,
        collectionType: Mosto.PlaylistCollection,
    }],
});

exports = module.exports = Mosto;
