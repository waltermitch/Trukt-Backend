const Heroku = require('../Classes/HerokuPlatformAPI')

module.exports = async (context) => App.next(context, Heroku.getNewToken)