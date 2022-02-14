const controller = require('../HttpControllers/ActivityManagerController');
const router = require('express').Router();

const { uuidRegexStr } = require('../Utils/Regexes');

const prefix = '/activitylogs';

router
    .get(`${prefix}/:orderGuid(${uuidRegexStr})/:jobGuid(${uuidRegexStr})`, controller.getActivities);

module.exports = router;