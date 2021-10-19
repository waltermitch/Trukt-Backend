const invoiceController = require('../HttpControllers/InvoiceController');
const billController = require('../HttpControllers/BillController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const billPrefix = '/bill';
const invoicePrefix = '/invoice';

router
    .get(`${billPrefix}/:billGuid(${uuidRegexStr})`, billController.getBill)
    .get(`${invoicePrefix}/:invoiceGuid(${uuidRegexStr})`, invoiceController.getInvoice)
    .get(`${invoicePrefix}/order/:orderGuid(${uuidRegexStr})`, invoiceController.getOrderInvoices)
    .get(`${invoicePrefix}/job/:jobGuid(${uuidRegexStr})`, invoiceController.getJobInvoices)
    .post(`${billPrefix}`, (req, res) => http(req, res, billController.createBills))
    .post(`${invoicePrefix}`, (req, res) => http(req, res, invoiceController.createInvoices));

module.exports = router;