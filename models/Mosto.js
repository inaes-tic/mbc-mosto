var Backbone   = require('backbone')
,   relational = require('backbone-relational')
,   config     = require('mbc-common').config.Mosto.General
,   path       = require('path')
,   uuid       = require('node-uuid')
,   _          = require('underscore')
,   moment     = require('moment')
,   mvcp       = require('../drivers/mvcp/mvcp-driver')
,   semaphore  = require('semaphore')
;

var Mosto = {};

function bubbleEvents(self, name) {
    return (function(event) {
        var args = [].slice(arguments, 1);
        var event_name = event.split(':');
        event_name.splice(1,0,name);
        event_name = event_name.join(':');
        this.trigger(event_name, args);
    }).bind(self)
}

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
    initialize: function() {
        this.driver = new mvcp('melted');
        this.semaphore = semaphore(1);
        this.take = this.semaphore.take;
        this.leave = this.semaphore.leave;

        this.fetch();
    },
    sync: function(method, model, options) {
        /*
         * override this collection's sync method so it reads and writes from / to
         * melted
         */
        var self = this;
        self.take(function() {
            if( method == 'read' ) {
                var promise = self.driver.getServerPlaylist().then(self.loadFromMelted.bind(self));
                promise = promise.then(function() { return self.driver.getServerStatus() }).then(
                    function(status) {
                        /*
                         * Now I represent the playlist on the melted driver exactly. But I don't
                         * know the start and end times for each of the clips (because they weren't
                         * loaded from the database), so I need to build it.
                         *
                         * if I'm empty, I shouldn't do anything. If I'm not empty and the player is
                         * stopped, I should start it on the first clip. If I'm not empty and the
                         * player is running, I should sync the start / end for each of my Medias
                         */
                        }
                    });
                promise.fin(self.leave);
            }
        });
    },
    loadFromMelted: function(clips) {
        var toAdd = [];
        clips.forEach((function(clip) {
            toAdd.push(Mosto.Media(clip));
        }).bind(this));
        this.add(toAdd, { merge: true });
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
        this.get('medias').on('all', bubbleEvents(this, 'medias'));
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
        this.get('playlists').on('all', bubbleEvents(this, 'playlists'));
        if (!attributes.melted_medias)
            this.set('melted_medias', new Mosto.MeltedCollection());
        this.get('melted_medias').on('all', bubbleEvents(this, 'melted_medias'));
    },

    save: function() {
        this.get('melted_medias').set(this.get('playlists').getMedias());
    },
});

var playlists = new Mosto.LoadedPlaylists();

Mosto.Playlists = playlists;

exports = module.exports = Mosto;
