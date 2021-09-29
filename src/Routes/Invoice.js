const controller = require('../HttpControllers/InvoiceController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const prefix = '/invoice';

router
<<<<<<< HEAD
    .get(`${prefix}/:invoiceId(${uuidRegexStr})`, (req, res) => http(req, res, controller.constructor.getInvoice))
    .post(`${prefix}`, (req, res) => http(req, res, controller.constructor.createInvoices));
=======
    .get(`${prefix}/:invoiceId(${uuidRegexStr})`, (req, res) => http(req, res, controller.getInvoice))
    .post(`${prefix}`, (req, res) => http(req, res, controller.createInvoices));
>>>>>>> QBO-33

module.exports = router;