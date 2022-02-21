const controller = require('../HttpControllers/LoadboardRequestController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/loadboard/requests';

router
    .get(`${prefix}/job/:jobGuid(${uuidRegexStr})`, controller.getByJobGuid)
    .post(`${prefix}/create`, controller.createRequestFromIncomingWebHook)
    .post(`${prefix}/cancel`, controller.cancelRequestFromIncomingWebHook)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/accept`, controller.acceptLoadRequest)
    .put(`${prefix}/:requestGuid(${uuidRegexStr})/decline`, controller.declineLoadRequest);

module.exports = router;
