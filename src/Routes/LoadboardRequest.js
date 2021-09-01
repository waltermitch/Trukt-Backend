const controller = require('../HttpControllers/LoadboardRequestController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard/requests';

router
    .get(`${prefix}/:jobGuid(${uuidRegexStr})`, controller.constructor.getByJobGuid)
    .post(`${prefix}/create`, controller.constructor.postcreateRequest)
    .post(`${prefix}/cancel`, controller.constructor.postcancelRequest)
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/accept`, controller.constructor.acceptLoadRequest)
    .post(`${prefix}/:jobGuid(${uuidRegexStr})/decline`, controller.constructor.declineLoadRequest);

module.exports = router;
