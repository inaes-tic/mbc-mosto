var Backbone   = require('backbone')
,   relational = require('backbone-relational')
,   config     = require('mbc-common').config.Mosto.General
,   path       = require('path')
,   uuid       = require('node-uuid')
,   _          = require('underscore')
,   moment     = require('moment')
;

var Mosto = {};

Mosto.Playlist = Backbone.Model.extend({
    /**************************
     * taken from api/Playlist
     **************************/
    urlRoot: "mosto/playlist",
    idAttribute: "_id",

    initialize: function (attributes, options) {
        console.log ('creating new Mosto.Playlist');
        Backbone.Model.initialize.call(this, attributes, options);
        attributes.name = attributes.name || attributes._id;

        if( !attributes.start )
            throw new Error("Must provide a start date");
        attributes.start = moment(attributes.start);
        if (!attributes.end )
            throw new Error("Must provide an end date");
        attributes.end = moment(attributes.end);

        if( !medias || !medias.length )
            throw new Error("Cannot create playlist without medias");

        return attributes;
    },


    },
    defaults: {
        name: null,
        start: null,   // moment
        medias: [];    // collection?
        end: null,     // moment
        mode: "snap",
        loaded: false,
    }
});

Mosto.Collection = Backbone.Collection.extend({
    model: Mosto.Playlist,
    comparator: function(playlist) {
        // remember, comparator is called only on insert, update doesn't re-sort
        //  but .add(.., {merge: true}) DOES re-sort!
        return playlist.get("start"); //XXX(xaiki): should it be _id ?
    },

    url: 'mosto/playlist',
    backend: 'mostoplaylistbackend',
    initialize: function () {
        console.log ('creating new Media.Collection');
        Backbone.Collection.prototype.initialize.call (this);
    }
});

exports = module.exports = Mosto;
