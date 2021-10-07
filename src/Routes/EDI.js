const controller = require('../HttpControllers/EDIController');
const { middlewareEDI } = require('../Authorization/Auth');
const router = require('express').Router();

router
    .use(middlewareEDI())
    .get('/edi/990/outbound/reject', (req, res, next) => controller.constructor.loadTenderResponse('reject', req, res, next))
    .get('/edi/990/outbound/accept', (req, res, next) => controller.constructor.loadTenderResponse('accept', req, res, next))
    .post('/edi/204/inbound', controller.constructor.createTender)
    .get('/edi/214/outbound', controller.constructor.outbound214)
    .put('/edi/214/inbound', controller.constructor.inbound214);

module.exports = router;