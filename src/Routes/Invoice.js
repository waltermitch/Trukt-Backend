const controller = require('../HttpControllers/InvoiceController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/invoice';

router
    .get(`${prefix}/:invoiceId(${uuidRegexStr})`, controller.constructor.getInvoice)
    .post(`${prefix}`, controller.constructor.createInvoices);

module.exports = router;