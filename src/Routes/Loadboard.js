const controller = require('../HttpControllers/LoadboardController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard';

router
    .put(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.handlePost)
    .delete(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.handleUnpost);

module.exports = router;