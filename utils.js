var moment = require('moment');

var _ = require('underscore');

// copypasta from http://michalbe.blogspot.com/2011/02/javascript-random-numbers-with-custom.html
var seededRandom = function ( nseed ) {
    var self = this;
    var constant = Math.pow(2, 13)+1,
    prime = 37,
    maximum = Math.pow(2, 50);

    self.seed = function (nseed) {
        if (nseed) {
            self._seed = nseed;
        } else {
            var old = self._seed;
            self._seed = (new Date()).getTime();
            return old;
        }
    };

    self.seed(nseed);

    self.next = function() {
        self._seed *= constant;
        self._seed += prime;
        self._seed %= maximum;

        return self._seed;
    }
};

var random = new seededRandom();

exports = module.exports = {
    getXmlFileNameFromClip: function(clip) {
        return clip.playlist_id + "-" + clip.id + ".xml";
    },

    getPlaylistIdFromXmlFileName: function(filename) {
        var aux = filename.split("-");
        if ( aux.length > 0 ) {
            filename = aux[0];
        }
        return filename;
    },

    getClipIdFromXmlFileName: function(filename) {
        // return everything between the first - and .xml
        var match = filename.match(/^[^-]+-(.*)\.xml$/);
        if( match ) {
            return match[1];
        }
    },

    getTimeLengthFromFrames: function(frames, fps) {
        var seconds = parseFloat(frames) / parseFloat(fps);
        var minutes = 0;
        if (seconds > 60) {
            minutes = parseInt(seconds / 60);
            seconds = parseInt (seconds - (minutes * 60));
        }
        var hours = 0;
        if (minutes > 60) {
            hours = parseInt(hours / 60);
            minutes = parseInt(minutes - (hours * 60));
        }
        return "." + hours + ":" + minutes + ":" + seconds;
    },

    getCurrentPosFromClip: function(actualFrame, totalFrames) {
        return parseFloat(actualFrame / totalFrames);
    },

    getFramePositionFromClock: function( clock_position, clip_start, frames_length, fps ) {        
        var millis = moment.duration( clock_position - clip_start ).asMilliseconds();
        var frame_position = Math.max( (millis / 1000.0 ) * fps, frames_length - 1);
        return frame_position;
    },

    convertFramesToSeconds: function ( frames, fps ) {
        return frames/fps;
    },

    convertLengthToMilliseconds: function ( frames ) {
        var m = moment( frames, "HH:mm:ss.SS");
        return m.hours()*60*60*1000 + m.minutes()*60*1000 + m.seconds()*1000 + m.milliseconds();
    },

    convertFramesToMilliseconds: function ( frames, fps ) {        
        if ( isNaN(frames) || fps+""=="NaN" || fps==undefined || fps===false || fps==0) {            
            var m = moment( frames, "HH:mm:ss.SS");
            if (m) return m.hours()*60*60*1000 + m.minutes()*60*1000 + m.seconds()*1000 + m.milliseconds();
        }
        fps = parseFloat(fps);
        var millis = frames * 1000.0 / (1.0 * fps);
        if (millis!==undefined) return millis;
        console.error("mbc-mosto: utils.convertFramesToMilliseconds frames: " + frames + " fps:" + fps);
    },

    convertDurationToString: function( moment_duration ) {
        return moment_duration.hours()+":"+moment_duration.minutes()+":"+moment_duration.seconds()+"."+moment_duration.milliseconds();
    },

    convertUnixToDate:  function ( unix_timestamp ) {
        //var date = new Date(unix_timestamp*1000);
        var date = new moment(unix_timestamp);
        return date.format("hh:mm:ss");
    },

    convertDateToUnix:  function ( date_timestamp ) {
        var date = new moment(date_timestamp);
        return date.unix();
    },

    random: random,

// from underscore.js
    shuffle: function(obj, seed) {
        var _random = function(min, max) {
          if (max == null) {
            max = min;
            min = 0;
          }
          return min + Math.floor((random.next()/Math.pow(2,50)) * (max - min + 1));
        };

        if (seed) {
            random.seed(seed);
        }

        var rand;
        var index = 0;
        var shuffled = [];
        _.each(obj, function(value) {
          rand = _random(index++);
          shuffled[index - 1] = shuffled[rand];
          shuffled[rand] = value;
        }, this);
        return shuffled;
    },

};
