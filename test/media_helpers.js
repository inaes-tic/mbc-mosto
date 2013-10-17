var fs      = require('fs'),
    xml2js  = require('xml2js'),
    crypto  = require('crypto'),
    moment  = require('moment'),
    seed    = require('seed-random'),
    _       = require('underscore'),
    ScheduledMedia   = require('../api/ScheduledMedia'),
    Media   = require('../api/Media');
    CMedia  = require('mbc-common/models/Media');

function parseXMLs(path) {
    if (path === undefined) {
        path = "test/videos/"; // TODO FIXME XXX: ugly hardcoded -> should be in config?
    }

    // Get XMLs
    var files = fs.readdirSync(path);
    var xmls = files.filter(function(elem) {
        return (elem.substr(0, 5) !== 'blank') && (elem.substr(elem.length - 4).toLowerCase() === ".xml");
    });

    // Pars'em
    var parsed = [];
    for (var i = 0; i < xmls.length; ++i) {
        var content = fs.readFileSync(path + xmls[i]);
        xml2js.parseString(content, function (err, result) {
            parsed.push({filename: String(xmls[i]), data: result});
        });
    }
    return parsed;
}

/*
 *   getMedia(path)
 *    - path: optional path
 *
 *   Scans given path (or default) getting media files and returns Media objects array
 */
exports.getMedia = function(path) {
    // Default path
    if (path === undefined) {
        path = "test/videos/"; // TODO FIXME XXX: ugly hardcoded -> should be in config?
    }

    var parsed = parseXMLs(path);

    // Populate Media
    var all_media = parsed.map(function(elem) {
        var m = new Media();
        m.name = elem.filename;
        m.id = crypto.createHash('md5').update(m.name).digest('hex'); // Digest Name
        m.file = process.cwd() + "/" + path + elem.filename;
        m.fps = parseInt(elem.data["mlt"]["profile"][0]["$"]["frame_rate_num"], 10);
        m.playlist_id = "generated";
        m.type = "xml";

        // Milliseconds = Frames / FPS * 1000
        var ms_length = parseInt(elem.data["mlt"]["producer"][0]["$"]["out"], 10) / m.fps * 1000;
        var tmp_length = moment.duration({milliseconds: ms_length});
        m.length = tmp_length.hours() + ":" + tmp_length.minutes() + ":" + tmp_length.seconds() + "." + tmp_length.milliseconds();

        return m;
    });

    return all_media;
};

/*
 *   getMBCMedia(path)
 *    - path: optional path
 *
 *   Scans given path (or default) getting media files and returns mbc-common.models.Media objects array
 */
exports.getMBCMedia = function(path) {
    if (path === undefined) {
        path = "test/videos/"; // TODO FIXME XXX: ugly hardcoded -> should be in config?
    }

    var parsed = parseXMLs(path);
    var medias = parsed.map(function(elem) {
        var params = {};
        params.name = elem.filename;
        params._id = crypto.createHash('md5').update(params.name).digest('hex');
        params.file = process.cwd() + '/' + path + elem.filename;
        params.fps = parseInt(elem.data.mlt.profile[0]["$"].frame_rate_num, 10);
        var frames = parseInt(elem.data.mlt.producer[0]["$"].out, 10);
        var duration = moment("0:0:0.0", "HH:mm:ss.SSS").add(exports.framesToMilliseconds(frames, params.fps));
        params.durationraw = duration.format("HH:mm:ss.SSS");
        return new CMedia.Model(params);
    });
    return medias;
};


/*
 *   getTotalMediaLength(media_array)
 *    - media_array: an array of Media objects
 *
 *   Returns the sum of all media lenghts in milliseconds
 */
exports.getTotalMediaLength = function(media_array) {
    return media_array.reduce(function(prev_val, cur_val) {
        return prev_val + exports.mediaLengthToMilliseconds(cur_val.length);
    }, 0);
};


/*
 *   getExpectedMediaAtTime(media_array, time_milliseconds)
 *    - media_array: an array of Media objects
 *    - time_milliseconds: the time at which i want to know what clip and frame expect
 *
 *   Returns the media that should be playing at the queried time along with the expected frame
 */
exports.getExpectedMediaAtTime = function(media_array, time_milliseconds) {
    var tmp_time = time_milliseconds;
    for (var i = 0; i < media_array.length; ++i) {
        var elem = media_array[i];
        var ms_length = exports.mediaLengthToMilliseconds(elem.length);
        if (ms_length > tmp_time) { // XXX: should this be (>=) instead of (>) ?
            return {
                media_id: elem.id,
                frame: Math.floor(tmp_time / 1000 * elem.fps),
            };
        } else {
            tmp_time -= ms_length;
        }
    }

    // No more media
    return {
        media_id: "blank_id",
        frame: Math.floor(tmp_time / 1000 * 25),
    };
};

/*
 *   mediaLengthToMilliseconds(length)
 *    - length: media length in format HH:mm:ss:SSS
 *
 *   Converts string length into milliseconds
 */
exports.mediaLengthToMilliseconds = function(length) {
    var m = moment(length, "HH:mm:ss.SSS");
    return moment.duration({
        hours: m.hours(),
        minutes: m.minutes(),
        seconds: m.seconds(),
        milliseconds: m.milliseconds(),
    });
};

exports.framesToMilliseconds = function(frames, fps) {
    return parseInt((frames / fps) * 1000);
};


// Extend underscore with fixed seed random methods
_.mixin({
    shuffleSeed: function(list, s) {
        seed(s, true);
        var ret = _.shuffle(list);
        seed(undefined, true);
        return ret;
    },
    seededRandom: function(s) {
        seed(s, true);
        var ret = Math.random();
        seed(undefined, true);
        return ret;
    },
    randint: function(x, y, s) {
        var from = 0;
        var to = 0;
        if( y === undefined )
            to = x;
        else {
            from = x;
            to = y;
        }
        var width = to - from;
        return (parseInt(seed(s)() * width) + from)
    },
    randelem: function(list) {
        if( !(list && list.length) )
            return;
        return list[_.randint(list.length)];
    },
    draw: function(list, n) {
        if( !(list && list.length) )
            return;
        var ret = [];
        for(var i = 0 ; i < n ; i++) {
            ret.push(_.randelem(list));
        }
        return ret;
    },
});
