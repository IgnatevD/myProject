// Set this to true for a live server and false for development
global.live = false;

var globals = {
  // API Version
  api: 'v0',

  // Database Host
  DBHost: 'mariadb',

  // Name of the database the server talks to
  DBDatabase: 'osmosis',

    // Username used to access this database
  DBUsername: 'root',

  // Password used to access mysql (empty for docker)
  DBPassword: '',

  // Name of settings DB
  DBSettingsDatabase: 'osmosis_settings',

  // Name of tracking DB
  DBTrackDatabase: 'osmosis_track',

  // Location where large cache objects are stored
  cacheDir: '/var/osmosis/data/cache/',

  // Location where site navigation maps are stored
  navMapDir: '/var/osmosis/data/cache/',

  // Location where the osmosis_static repo will be present
  staticDir:'/var/osmosis/osmosis_static/',
};

module.exports = globals;
