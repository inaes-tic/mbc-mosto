var moment = require('moment');

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
        var aux = filename.split("-");
        if ( aux.length > 1 ) {
            aux = aux[1];
            filename = aux.substring(0, aux.length - 5);
        }
        return filename;
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

    convertFramesToSeconds: function ( frames, fps ) {
        return frames/fps;
    },

    convertLengthToMilliseconds: function ( frames ) {
        var m = moment( frames, "HH:mm:ss.SS");
        return m.hours()*60*60*1000 + m.minutes()*60*1000 + m.seconds()*1000 + m.milliseconds();
    },

    convertFramesToMilliseconds: function ( frames, fps ) {
        if (fps+""=="NaN" || fps==undefined || fps===false || fps==0) {
            var m = moment( frames, "HH:mm:ss.SS");
            return m.hours()*60*60*1000 + m.minutes()*60*1000 + m.seconds()*1000 + m.milliseconds();
        }
        return frames * 1000.0 / (1.0 * fps);
    },

    convertUnixToDate:  function ( unix_timestamp ) {
        //var date = new Date(unix_timestamp*1000);
        var date = new moment(unix_timestamp);
        return date.format("hh:mm:ss");
    },

    convertDateToUnix:  function ( date_timestamp ) {
        var date = new moment(date_timestamp);
        return date.unix();
    }
};
