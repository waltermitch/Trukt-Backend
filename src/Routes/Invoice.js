const controller = require('../HttpControllers/InvoiceController');
const { uuidRegex } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/invoice';

router
    .get(`${prefix}/:invoiceId(${uuidRegex})`, controller.constructor.getInvoice)
    .post(`${prefix}`, controller.constructor.createInvoices);

module.exports = router;