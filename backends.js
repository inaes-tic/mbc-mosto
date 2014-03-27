var mbc            = require('mbc-common'),
    search_options = mbc.config.Search,
    collections    = mbc.config.Common.Collections,
    backboneio     = require('backbone.io'),
    middleware     = new mbc.iobackends().get_middleware(),
    _              = require('underscore')
;

module.exports = function (db, test_db) {
    var backends = {
        status: {
            use: [middleware.uuid],
            redis: true,
            mongo: {
                db: db,
                collection: collections.Status,
                opts: { search: search_options.Status },
            }},
        frame: {
            store: backboneio.middleware.memoryStore(db, 'progress', {}),
            redis: true,
        },
        mostomessages: {
            redis: true,
            use:   [middleware.tmpId],
            mongo: {
                db: db,
                collection: collections.Mostomessages,
                opts: { search: search_options.Mostomessages },
            }},
        volatilemostomessages: {
            redis: true,
            use:   [middleware.tmpId],
            store: backboneio.middleware.memoryStore(db, 'volatilemessages', {}),
        },
    };

    // only create the test backends if needed.
    if (test_db != undefined) {
        _.extend(backends, {
            media: {
                mongo: {
                    db: test_db,
                    collection: collections.Medias,
                    opts: { search: search_options.Medias },
                }},
            list: {
                use: [middleware.uuid, middleware.tmpId],
                mongo: {
                    db: test_db,
                    collection: collections.Lists,
                    opts: { search: search_options.Lists },
                }},
            piece: {
                use: [middleware.uuid],
                mongo: {
                    db: test_db,
                    collection: collections.Pieces,
                    opts: { search: search_options.Pieces },
                }},
            sched: {
                use: [middleware.uuid, middleware.publishJSON],
                mongo: {
                    db: test_db,
                    collection: collections.Scheds,
                    opts: { search: search_options.Scheds },
                }},
            transform: {
                use: [middleware.uuid],
                mongo: {
                    db: test_db,
                    collection: collections.Transforms,
                    opts: { search: search_options.Transforms },
                }},
        });
    }

    return backends;
};


