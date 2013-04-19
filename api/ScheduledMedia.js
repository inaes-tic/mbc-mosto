function ScheduledMedia( media, schedule_time, schedule_duration, expected_start, expected_end ) {
    this.media   = media;
    this.schedule_time = schedule_time;
    this.schedule_duration = schedule_duration;
    this.expected_start = expected_start;
    this.expected_end = expected_end;
};

exports = module.exports = function(media, schedule_time, schedule_duration, expected_start, expected_end) {
    var clip = new ScheduledMedia(media, schedule_time, schedule_duration, expected_start, expected_end);
    return clip;
};
