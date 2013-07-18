var path = require('path'),
    cwd  = process.cwd();

module.exports = {
    Caspa: {
        Branding: {
            name: 'MBC Playout {mlt edition}',
            description: 'A simple Playout server built with magic and love',
        },
        Dirs: {
            pub : path.join(cwd, 'public'),
            views : path.join(cwd, 'views') ,
            styles : path.join(cwd, 'styles'),
            models : path.join(cwd, 'models'),
            vendor : path.join(cwd, 'vendor'),
            uploads: path.join(cwd, 'public', 'uploads', 'incoming'),
            screenshots: path.join(cwd, 'public','sc'),
            scrape : path.join(cwd, 'videos'),
        },
        Others: {
            timezone: 'UTC',
        },
    },
    Mosto: {
        Branding: {
            name: 'MBC Mosto',
            description: 'MBC Playout\'s playlist juggler',
        },
        General: {
            fps: 25,
            resolution: "hd",
            playout_mode: "snap",
            min_scheduled_hours: "4",
            timer_interval: 1000,
            blank: path.join(cwd, 'images', 'blank.xml'),
            reload_timer_diff: 20000,
            playlist_server: "mongo",
            mvcp_server: "melted",
        },
        Melted: {
            bin: "melted",
            root: cwd,
            host: "localhost",
            port: 5250,
            output: "sdl",
            playlists_xml_dir: path.join('test', 'playlists'),
        },
        Mongo: {
            load_time: 120,
        },
        Json: {
            to_read:    path.join(cwd ,'playlists','to_read'),
            playing:    path.join(cwd ,'playlists', 'playing'),
            old:    path.join(cwd ,'playlists','old'),
        },
    },
    Common: {
        Branding: {
            name: 'MBC Common',
            description: 'Common code for mbc-playout and mbc-mosto',
        },
        MediaDB: {
            dbName: "mediadb",
            dbHost: "localhost",
            dbPort: 27017,
            dbUser: "",
            dbPassword: "",
        },
        Redis: {
            host: "localhost",
            port: 6379,
            password: "",
        },
    }
}
