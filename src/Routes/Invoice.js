const controller = require('../HttpControllers/InvoiceController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/invoice';

router
    .get(`${prefix}/:invoiceId(${uuidRegexStr})`, (req, res) => http(req, res, controller.constructor.getInvoice))
    .post(`${prefix}`, (req, res) => http(req, res, controller.constructor.createInvoices));

module.exports = router;