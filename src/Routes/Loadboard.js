const controller = require('../HttpControllers/LoadboardController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard';

router
    .post(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.handleCreate)
    .put(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.handlePost)
    .delete(`${prefix}/:jobId(${uuidRegexStr})`, controller.constructor.handleUnpost);

module.exports = router;