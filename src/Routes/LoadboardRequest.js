const controller = require('../HttpControllers/LoadboardRequestController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard/requests';

router
    .get(`${prefix}/job/:jobGuid(${uuidRegexStr})`, controller.constructor.getByJobGuid)
    .post(`${prefix}/create`, controller.constructor.postcreateRequest)
    .post(`${prefix}/cancel`, controller.constructor.postcancelRequest)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/accept`, controller.constructor.acceptLoadRequest)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/decline`, controller.constructor.declineLoadRequest);

module.exports = router;
