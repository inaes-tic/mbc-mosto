var Backbone   = require('backbone')
,   config     = require('mbc-common').config.Mosto.General
,   path       = require('path')
,   uuid       = require('node-uuid')
,   _          = require('underscore')
,   moment     = require('moment')
,   mvcp       = require('../drivers/mvcp/mvcp-driver')
,   semaphore  = require('semaphore')
,   utils      = require('../utils')
,   Q          = require('q')
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
        // playlist_order: undefined,
        // actual_order: undefined,
        name: '',
        type: 'default',
        // file: undefined,
        // length: undefined,
        // fps: undefined,
        // start: undefined,
        // end: undefined,
        in: undefined,
        out: undefined,
    },

    constructor: function(attributes, options) {
        options = _.defaults(options || {}, { override_id: true });
        attributes._id = attributes.id;
        if( options.override_id )
            attributes.id = attributes.playlist_id + '-' + attributes.id;
        Backbone.Model.apply(this, arguments);
    },

    initialize: function(attributes, options) {
        if( !attributes.fps ){
            this.set('fps', config.fps);
        }
        if( typeof attributes.length == 'string' ) {
            var m = moment(attributes.length, 'HH:mm:ss.SSS');
            attributes.length = moment.duration({ hours: m.hour(), minutes: m.minute(), seconds: m.second(), milliseconds: m.millisecond() });
        }
        if( moment.isDuration(attributes.length) ) {
            attributes.length = parseInt(attributes.length.asSeconds() * this.get('fps'));
        }

        if( attributes.in == undefined ) {
            attributes.in = 0;
        }
        if( attributes.out == undefined ) {
            attributes.out = attributes.length;
        }
        this.set({ in: attributes.in,
                   out: attributes.out,
                   length: attributes.out - attributes.in });

        var toMoment = function(model, value, options) {
            if( !moment.isMoment(value) )
                model.set('start', moment(value), { silent: true });
        };

        this.on('change:start', toMoment);
        this.on('change:end', toMoment);
    },
});

Mosto.BlankClip = new Mosto.Media({
    //name: path.basename(config.black).replace(path.extname(config.black, '')),
    name: "InfiniteBlankClip",
    //file: config.black,
    file: process.cwd() + '/test/videos/blank.xml',
    //fps: config.fps,
    fps: 25,
});

Mosto.MediaCollection = Backbone.Collection.extend({
    /* this is a playlist's list of clips, it sorts by playlist_order */
    model: Mosto.Media,
    comparator: 'playlist_order',
});

Mosto.MeltedCollection = Backbone.Collection.extend({
    model: Mosto.Media,
    comparator: 'start',
    initialize: function() {
        this.driver = new mvcp('melted');
        console.log("MeltedCollection: [INFO] MVCP Server instantiated: " + this.driver.uuid);
        this.semaphore = semaphore(1);
        this.take = this.semaphore.take;
        this.leave = this.semaphore.leave;

        var self = this;
        this.on('allx', function(event) {
            console.log(self, event, arguments);
        });

        this.fetch();
    },

    set: function(models, options) {
        var self = this
        options = _.defaults(options || {}, { set_melted: true });
        Backbone.Collection.prototype.set.call(this, models, _.extend(options, { silent: true }));
        if(! options.set_melted )
            return;
        self.take(function() {
            return self.driver.getServerStatus().then(function(status) {

                /* remove everything but the current clip */
                var ret = Q.resolve().then(function() {
                    return self.driver.cleanPlaylist();
                });

                var expected = self.getExpectedMedia();
                var wholeList = true;
                if( expected.media ) {
                    if(status.currentClip && ( expected.media.id.toString() == status.currentClip.id.toString() )) {
                        wholeList = false;
                        /* since I don't need to jump, and I can't insert clips before
                           the current one without getting a jump, I'll strip myself of
                           any clips before this */
                        var ids = self.pluck('id');
                        var cur_i = ids.indexOf(status.currentClip.id);
                        self.remove(ids.slice(0, cur_i));

                        /* and then put everything after into melted */
                        _.range(1, self.length).forEach(function(i) {
                            ret = ret.then(function() {
                                return self.driver.appendClip(self.at(i).toJSON());
                            });
                        });
                    }
                } 
                if( wholeList ) {
                    /* since I've got to jump anyways, I'll add everything at the end
                       of the list */
                    self.forEach(function(c, i) {
                        ret = ret.then(function() {
                            return self.driver.appendClip(c.toJSON());
                        });
                    });

                    if( status.currentClip ) {
                        /* I leave the current clip at the top of the melted playlist, it won't do any harm */
                        ret = ret.then(function() {
                            return self.add(status.currentClip, { at: 0, set_melted: false });
                        });
                    }
                }

                self.forEach(function(c, i) {
                    c.set('actual_order', i);
                });
                return ret;
            }).fin(function(){
                self.leave();
            });
        });
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
                promise = promise.then(self.driver.getServerStatus.bind(self.driver)).then(
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
                        if( !self.length )
                            return;
                        // statuses: offline|not_loaded|playing|stopped|paused|disconnected|unknown
                        
                        if( status.status == 'stopped' ) {
                            self.adjustTimes(0, 0);
                            // LET HEARTBEATS HANDLE THIS...
//                            return self.driver.play();
                        } else {
                            var current = self.findWhere({id: status.currentClip.id})
                            var index = self.indexOf(current);
                            self.adjustTimes(index, status.currentClip.currentFrame);
                        }
                    });
                promise.fin(self.leave);
            }
        });
    },

    getExpectedMedia: function(time) {
        time = time || moment();
        var expected = {
            media: undefined,
            frame: undefined,
        };
        var media = this.find(function(media) {
            return media.get('start') <= time && media.get('end') >= time;
        });
        if( media ) {
            var elapsed = moment.duration(time - media.get('start')).asSeconds();
            var frame = parseInt(elapsed * media.get('fps'));
            expected.media = media;
            expected.frame = frame;
        }
        return expected;
    },

    adjustTimes: function(index, currentFrame) {
        var ftms = function(f, fps) {
            return utils.convertFramesToSeconds(f, fps) * 1000;
        };

        var current = this.at(index);

        var elapsedTime = ftms(currentFrame, current.get('fps'));
        var now = moment();
        current.set({
            start: now - elapsedTime,
            end: (now - elapsedTime) + ftms(current.get('totalFrames'), current.get('fps')),
        });
        for(var i = index - 1 ; i >= 0 ; i--) {
            var clip = this.at(i);
            var next = this.at(i+1);
            clip.set({
                end: next.get('start'),
                start: next.get('start') - ftms(clip.get('length'), clip.get('fps')),
            });
        }
        for(var i = index + 1 ; i < this.length ; i++) {
            var clip = this.at(i);
            var prev = this.at(i-1);
            clip.set({
                start: prev.get('end'),
                end: prev.get('end') + ftms(clip.get('length'), clip.get('fps')),
            });
        }
    },

    loadFromMelted: function(clips) {
        var toAdd = [];
        clips.forEach(function(clip) {
            toAdd.push(new Mosto.Media(clip, { override_id: false }));
        });
        this.add(toAdd, { merge: true, silent: true });
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
        var self = this;

        this.set('name', this.get('name') || this.get('_id'));

        if( !attributes.start )
            throw new Error("Must provide a start date");
        this.set('start', moment(this.get('start')));
        if (!attributes.end )
            throw new Error("Must provide an end date");
        this.set('end', moment(this.get('end')));

        if ( !(attributes.medias instanceof Mosto.MediaCollection) )
            this.set('medias', new Mosto.MediaCollection());

        /*
          this is important: 'add' events are triggered AFTER every model has been
          added to the collection, and the collection's been SORTED. So we can trust
          this to be right.

          Also important: a second 'set' on a model MAKES IT FORGET THE PREVIOUS MODIFICATION.
          i.e.: model.changedAttributes() does not compare with the server.
        */
        this.get('medias').on('add', function(model, collection, options) {
            model.playlist = self;
            var index = collection.indexOf(model);
            self.adjustMediaTimes(index);
        });
        this.on('change:start', function(model, value, options) {
            self.adjustMediaTimes(0);
        });


        if ( attributes.medias instanceof Array )
            this.get('medias').set(attributes.medias);
        this.get('medias').on('all', bubbleEvents(this, 'medias'));
    },
    getMedias: function() {
        return this.get('medias').toArray();
    },
    adjustMediaTimes: function(fromIndex) {
        var collection = this.get('medias');
        var timewalk = moment(fromIndex > 0 ?
                              collection.at(fromIndex-1).get('end') :
                              this.get('start'));
        for(var i = fromIndex ; i < collection.length ; i++) {
            var media = collection.at(i);
            media.set('start', moment(timewalk));
            timewalk.add((media.get('length') / media.get('fps')) * 1000);
            media.set('end', moment(timewalk));
        }
    },
});

Mosto.PlaylistCollection = Backbone.Collection.extend({
    model: Mosto.Playlist,
    comparator: 'start',
    initialize: function() {
        Backbone.Collection.prototype.initialize.apply(this, arguments);
        this.on('sort', this.addBlanks.bind(this));
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
        var now = moment();
        var first = this.at(0);
        if( first && first.get('start') > now ) {
            this.addBlankPlaylist(now, first.get('start'), 0);
        }
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
        var options = { at: at };
        var blank = Mosto.BlankClip.clone();
        var length = parseInt(((to - from) / 1000) * blank.get('fps'));
        var playlist = new Mosto.Playlist({
            name: blank.get('name'),
            start: from,
            end: to,
        });
        blank.set({ 'id': to.valueOf() + '-blank',
                    length: length,
                    in: 0,
                    out: length });
        playlist.get('medias').add(blank);
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
        // set fires add, remove, change and sort
        var mm = this.get('melted_medias');
        var pl = this.get('playlists');
        mm.take(function() {
            mm.set(pl.getMedias());
            mm.leave()
        });
    },

    addPlaylist: function(playlist) {
        this.get('playlists').add(playlist, { merge: true });
        this.save();
    },
    removePlaylist: function(playlist) {
        this.get('playlists').remove(playlist);
        this.save();
    },
});

Mosto._globals = {}

Mosto.Playlists = function() {
    return Mosto._globals.playlists || (Mosto._globals.playlists = new Mosto.LoadedPlaylists());
}

exports = module.exports = Mosto;
