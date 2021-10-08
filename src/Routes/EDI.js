const controller = require('../HttpControllers/EDIController');
const { middlewareEDI } = require('../Authorization/Auth');
const router = require('express').Router();

const prefix = '/edi';

router
    .use(prefix, middlewareEDI())
    .get(`${prefix}/990/outbound/reject`, (req, res, next) => controller.constructor.loadTenderResponse('reject', req, res, next))
    .get(`${prefix}/990/outbound/accept`, (req, res, next) => controller.constructor.loadTenderResponse('accept', req, res, next))
    .post(`${prefix}/204/inbound`, controller.constructor.createTender)
    .get(`${prefix}/214/outbound`, controller.constructor.outbound214)
    .put(`${prefix}/214/inbound`, controller.constructor.inbound214);

module.exports = router;