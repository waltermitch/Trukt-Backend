const Heroku = require('../Classes/HerokuPlatformAPI');

module.exports = async (context) => App.timer(context, Heroku.getNewToken);