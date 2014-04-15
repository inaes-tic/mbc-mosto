var Backbone  = require('backbone')
,   mbc       = require('mbc-common')
,   config    = mbc.config.Mosto.General
,   path      = require('path')
,   uuid      = require('node-uuid')
,   _         = require('underscore')
,   moment    = require('moment')
,   mvcp      = require('../drivers/mvcp/mvcp-driver')
,   semaphore = require('semaphore')
,   utils     = require('../utils')
,   Q         = require('q')
,   logger    = mbc.logger().addLogger('MODELS')
;

var Mosto = {};

function bubbleEvents(self, name) {
    return (function(event) {
        var args = [].slice(arguments, 1);
        var event_name = event.split(':');
        event_name.splice(1,0,name);
        event_name = event_name.join(':');
        this.trigger(event_name, args);
    }).bind(self);
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
        blank: false
    },

    constructor: function(attributes, options) {
        attributes = _.defaults(attributes || {}, { id: uuid.v4() });
        options = _.defaults(options || {}, { override_id: true });
        attributes._id = attributes.id;
        if( options.override_id )
            attributes.id = attributes.playlist_id + '-' + attributes.id;
        Backbone.Model.apply(this, arguments);
    },

    initialize: function(attributes, options) {
        attributes = attributes || {};
//        if( !attributes.fps ){
            this.set('fps', parseFloat(config.fps));
//        }
        if( typeof attributes.length === 'string' ) {
            var m = moment(attributes.length, 'HH:mm:ss.SSS');
            attributes.length = moment.duration({ hours: m.hour(), minutes: m.minute(), seconds: m.second(), milliseconds: m.millisecond() });
        }
        if( moment.isDuration(attributes.length) ) {
            attributes.length = parseInt(attributes.length.asSeconds() * this.get('fps'));
        }

        if( attributes.in === undefined ) {
            attributes.in = 0;
        }
        if( attributes.out === undefined ) {
            attributes.out = attributes.in + attributes.length - 1;
        }
        this.set({ in: attributes.in,
                   out: attributes.out,
                   length: attributes.out - attributes.in + 1 });

        //TODO: Esta bien que siempre setee start? Se lo llama con change:end tambien
        var toMoment = function(model, value, options) {
            if( !moment.isMoment(value) ) {
                model.set('start', moment(value), { silent: true });
            }
        };

        var toMoment2 = function(model, value, options) {
            if( !moment.isMoment(value) ) {
                model.set('end', moment(value), { silent: true });
            }
        };

        this.on('change:start', toMoment);
        this.on('change:end', toMoment2);
    },
});

Mosto.BlankClip = {
    blank: true,
    name: "BlankClip",
    file: config.blank,
    fps: config.fps,
    in: 0,
    out: config.blank_length - 1,
    length: config.blank_length
};

Mosto.MediaCollection = Backbone.Collection.extend({
    /* this is a playlist's list of clips, it sorts by playlist_order */
    model: Mosto.Media,
    comparator: 'playlist_order'
});

Mosto.MeltedCollection = Backbone.Collection.extend({
    model: Mosto.Media,
    comparator: 'start',
    initialize: function() {
        //TODO: Inicializar el driver como corresponde
        this.driver = new mvcp('melted');
        logger.debug("MVCP Server instantiated: " + this.driver.uuid);
        this.initMvcpServer();
        //TODO: Cambiar esto por this.read = semaphore(1), asi queda mas claro
        this.semaphore = semaphore(1);
        this.take = this.semaphore.take;
        this.leave = this.semaphore.leave;
        this.write = semaphore(1);

        //TODO: Borrar esto
        var self = this;
        this.on('allx', function(event) {
            logger.debug(self, event, arguments);
        });

        this.fetch();
    },

    initMvcpServer: function() {
        var self = this;
        this.driver.on('reconnect', function(had_error) {
            self.trigger('melted-disconnected');
        });
        this.driver.on('connected', function() {
            self.trigger('melted-connected');
        });
        return this.driver.initServer();
    },

    stopMvcpServer: function() {
        return this.driver.stopServer();
    },

    getBlankMedias: function(from, to) {
        /* returns a list of consecutive blank medias to put between from and to */
        var ret = [];
        var blanks = this.filter(function(media) {
            //TODO: There is the posibility that media is not initialized.  See get func from set
            return (media.get('blank') &&
                    (media.get('start') < to &&
                     media.get('end') > from));
        });
        var current = this.getExpectedMedia().media;
        var cur_ix = blanks.indexOf(current);
        if( cur_ix > 0 ) {
            /* I need to split the process in two:
               1) before current.start, adjust
               2) adjust current.end if possible, and then extend
            */
            ret.push.apply(ret, this.getBlankMedias(from, current.get('start')));
            // see if we can extend current
            if( current.get('out') < Mosto.BlankClip.out ) {
                current.set('out', Mosto.BlankClip.out );
            }
            ret.push(current);
            var end = moment(current.get('start')).add(
                moment.duration(current.get('length') / current.get('fps'), 'seconds'));
            current.set('end', end);
            ret.push.apply(ret, this.getBlankMedias(end, to));
            return ret;
        }
        /* if current is not in the list, I just create a bunch of BlankClips to fill
           in the range */
        var timewalk = moment(from);
        var maxLength = moment.duration(Mosto.BlankClip.length / Mosto.BlankClip.fps, 'seconds');
        while( timewalk < to ) {
            var clip = _.clone(Mosto.BlankClip);
            clip.id = 'BLANK-' + uuid.v4();
            clip.start = moment(timewalk);
            clip.end = moment(timewalk.add(Math.min(to - timewalk, maxLength)));
            clip.length = moment.duration(clip.end - clip.start);
            // make sure clip.out gets calculated from length
            delete clip.out;
            ret.push(clip);
        }
        return ret;
    },

    set: function(models, options) {
        var self = this;
        //TODO: BE CAREFULL WITH ACTUAL_ORDER, ITS MAKING TESTS FAIL!!!
        options = _.defaults(options || {}, { set_melted: true,
                                              fix_blanks: true,
                                              until: moment().add(moment.duration(parseInt(config.min_scheduled_hours), 'hours')) });

        var get = (function(model, attr) {
            return this._prepareModel(model, options).get(attr);
        }).bind(self);
        models = (_.isArray(models) && models) || [models];
        var files = [];
        models.forEach(function(item) {
            files.push(get(item, 'file'));
        });
        logger.info("Received models: ", files);
        var m = _.clone(models);
        if( options.fix_blanks ) {
            var now = moment();
            logger.debug("Fixing blanks " + now);
            if( m.length <= 0 ) {
                logger.warn("Nothing on the list! Loading all blanks");
                m.push.apply(m, self.getBlankMedias(now, options.until));
            } else {
                models.forEach(function(media, i) {
                    /* in falcon we'd say forfirst: forlast: and default: :( */
                    if( i === 0 ) {
                        var start = get(media, 'start');
                        logger.debug("FixingBlanks", "Clip " + get(media, 'file'), "Start " + start);
                        if( start > now ) {
                            logger.warn("Loading blanks at start of the list");
                            m.splice.apply(m, [0, 0].concat(self.getBlankMedias(now, start)));
                        }
                    } else {
                        var prev = models[i-1];
                        if( get(media, 'start') > get(prev, 'end') ) {
                            logger.warn("Loading blanks at the middle of the list");
                            m.splice.apply(m, [i, 0].concat(self.getBlankMedias(get(prev, 'end'), get(media, 'start'))));
                        }
                    }
                    if( i === (models.length - 1) ) {
                        /* for the last one, make sure it lasts at least until options.until */
                        if( get(media, 'end') < options.until ) {
                            logger.warn("Loading blanks at end of the list");
                            m.push.apply(m, self.getBlankMedias(get(media, 'end'), options.until));
                        }
                    }
                });
            }
        }
        logger.debug("Taking read semaphore");
        self.take(function() {
            logger.debug("Calling super.set");
            logger.debug("Models to set (m): " + m.length);
            logger.debug("Models to set (self): " + self.length);
            logger.debug("Options: " + options);
            Backbone.Collection.prototype.set.call(self, m, _.extend(options, { silent: true }));
            logger.debug("Models: ", self.length);
            if(! options.set_melted ) {
                logger.debug("We dont set melted, leaving read semaphore");
                self.leave();
                return false;
            }

            return self.driver.getServerStatus().then(function(status) {
                logger.debug("Obtained status: ", status);

                /* remove everything but the current clip */
                var ret = Q.resolve()               ;
                //                    .then(function() {
                logger.debug("Cleaning playlist");
                //    return
                ret = ret.then(function() {
                    return self.driver.cleanPlaylist().then(function(){
                    logger.debug("Playlist cleaned");});
                });
                //                });
                
                var expected = self.getExpectedMedia();

                var addClip = function(media) {
                    //return ret.then(function() {
                    logger.info("Adding media: " + media.get('file'));
                    return self.driver.appendClip(media.toJSON());
                    //});
                };

                if( ! expected.media ) {
                    logger.warn("If we fixed blanks, we NEVER should enter here", self.pluck('file'));
                    //TODO: After fixing blanks, we NEVER should enter here... Throw error??
                    self.forEach(function(c, i) {
                        //                        ret = ret.then(function() {
                        c.set("actual_order", i)
                        logger.debug("Queuing Append for clip: " + c.get('file'));
                        //    return
                        ret = ret.then(function() {
                            return addClip(c);
                        });
                        //                        });
                    });
                    logger.debug("Leaving read semaphore");
                    return ret.then(self.leave);
                }
                logger.debug("Expected media: ", {"media": expected.media.get('file'), "frame": expected.frame});

                var ids = self.pluck('id');
                // I need to add from expected clip
                var cur_i = ids.indexOf(expected.media.id);
                self.remove(ids.slice(0, cur_i));
                var add_current = false;

                if(status.currentClip && ( expected.media.id.toString() === status.currentClip.id.toString() )) {
                    logger.debug("Current playing clip is expected");
                } else {
                    // append expected clip
                    logger.debug("Queuing Append for expected clip: " + self.at(0).get('file'));
                    //                    ret =
                    ret = ret.then(function() {
                        return addClip(self.at(0)).then(function() {
                        logger.debug("Appended first clip");
                    });});

                    // I'll need to add the current clip to myself to make sure I keep reflecting melted status
                    add_current = status.currentClip;
                }

                // append next clip just in case
                if(self.length > 1) {
                    logger.debug("Queuing Append for next clip: " + self.at(1).get("file"));
                    ret = ret.then(function() {
                        return addClip(self.at(1)).then(function() {
                        logger.debug("Appended second clip");
                    });});
                }

                // generate a new promise that will release the read semaphore inmediatly after appending the next clip
                ret = ret.then(function() {
                    var start = 0;
                    if (add_current)
                        start = 1;
                    // we do this here in order to have actual order synched before leaving semaphore
                    logger.debug("Rearranging actual order");
                    self.forEach(function(c, i) {
                        c.set('actual_order', i + start);
                    });
                    logger.debug("Leaving read semaphore");
                    self.leave();
                });

                /* and then put everything after into melted */
                logger.debug("Queuing Append for rest of the clips");
                _.range(2, self.length).forEach(function(i) {
                    ret = ret.then(function() {
                        return addClip(self.at(i)).then(function(){
                        logger.debug("Appended %d-th clip", i);
                    });});
                });

                if( add_current ) {
                    logger.debug("Adding current (wrong) clip so we can reflect melted status");
                    /* I leave the current clip at the top of the melted playlist, it won't do any harm */
                    status.currentClip.actual_order = 0;
                    self.add(status.currentClip, { at: 0, set_melted: false, fix_blanks: false });
                }

                return ret;
            }).fail(function(err) {
                logger.error("Error loading clips to server", err);
                self.leave();
                //                throw err;
                self.set(models, options);
            }).fin(function(){
                logger.info("Leaving write semaphore");
                self.write.leave();
            });
        });
    },
    sync: function(method, model, options) {
        /*
         * override this collection's sync method so it reads and writes from / to
         * melted
         */
        var self = this;
        self.write.take(function() {
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

                        if( status.status === 'stopped' ) {
                            self.adjustTimes(0, 0);
                            // LET HEARTBEATS HANDLE THIS...
                            //                            return self.driver.play();
                        } else {
                            var current = self.findWhere({id: status.currentClip.id});
                            var index = self.indexOf(current);
                            self.adjustTimes(index, status.currentClip.currentFrame);
                        }
                    }).fin(function() {
                        self.write.leave();
                    });
            }
        });
    },

    getExpectedMedia: function(time) {
        time = time || moment();
        logger.debug("ExpectedMedia", "Time " + time);
        var expected = {
            media: undefined,
            frame: undefined
        };
        var media = this.find(function(media) {
            logger.debug("ExpectedMedia", "Media.start " + media.get('start'), "Media.end " + media.get('end'));
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
            end: (now - elapsedTime) + ftms(current.get('totalFrames'), current.get('fps'))
        });
        for(var i = index - 1 ; i >= 0 ; i--) {
            var clip = this.at(i);
            var next = this.at(i+1);
            clip.set({
                end: next.get('start'),
                start: next.get('start') - ftms(clip.get('length'), clip.get('fps'))
            });
        }
        for(var i = index + 1 ; i < this.length ; i++) {
            var clip = this.at(i);
            var prev = this.at(i-1);
            clip.set({
                start: prev.get('end'),
                end: prev.get('end') + ftms(clip.get('length'), clip.get('fps'))
            });
        }
    },

    loadFromMelted: function(clips) {
        var toAdd = [];
        clips.forEach(function(clip) {
            toAdd.push(new Mosto.Media(clip, { override_id: false }));
        });
        this.add(toAdd, { merge: true, silent: true, set_melted: false, fix_blanks: false });
    }
});

Mosto.Playlist = Backbone.Model.extend({
    defaults: {
        name: null,
        start: null,   // moment
        end: null,     // moment
        mode: config.playout_mode,
        loaded: false,
        medias: null
    },
    initialize: function (attributes, options) {
        logger.debug('Creating new Mosto.Playlist: ',{"name": attributes.name, "start": attributes.start});
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
    }
});

Mosto.PlaylistCollection = Backbone.Collection.extend({
    model: Mosto.Playlist,
    comparator: 'start',
    removeBlanks: function(options) {
        /*
         * forwards `options` to `remove`
         */
        this.remove(this.where({ blank: true }), options);
    },
    getMedias: function() {
        var medias = this.map(function(playlist) { return playlist.getMedias(); });
        return _.flatten(medias);
    }
});

Mosto.LoadedPlaylists = Backbone.Model.extend({
    defaults: {
        playlists: null,
        melted_medias: null
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
        mm.write.take(function() {
            mm.set(pl.getMedias());
        });
    },

    addPlaylist: function(playlist) {
        this.get('playlists').add(playlist, { merge: true });
        this.save();
    },
    removePlaylist: function(playlist) {
        this.get('playlists').remove(playlist);
        this.save();
    }
});

Mosto._globals = {};

Mosto.Playlists = function() {
    return Mosto._globals.playlists || (Mosto._globals.playlists = new Mosto.LoadedPlaylists());
};

exports = module.exports = Mosto;
