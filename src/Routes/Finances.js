const invoiceController = require('../HttpControllers/InvoiceController');
const billController = require('../HttpControllers/BillController');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

const billPrefix = '/bill';
const invoicePrefix = '/invoice';

router
    .get(`${billPrefix}/:billGuid(${uuidRegexStr})`, billController.getBill)
    .get(`${invoicePrefix}/:invoiceGuid(${uuidRegexStr})`, invoiceController.getInvoice)
    .get(`${invoicePrefix}/order/:orderGuid(${uuidRegexStr})`, (req, res, next) => invoiceController.getOrderFinances(req, res, next, 'order'))
    .get(`${invoicePrefix}/job/:jobGuid(${uuidRegexStr})`, (req, res, next) => invoiceController.getOrderFinances(req, res, next, 'job'))
    .get(`/order/:orderGuid(${uuidRegexStr})/invoices`, (req, res, next) => invoiceController.getFinances(req, res, next, 'order'))
    .get(`/job/:jobGuid(${uuidRegexStr})/bills`, (req, res, next) => invoiceController.getFinances(req, res, next, 'job'))
    .post(`${billPrefix}`, (req, res) => http(req, res, billController.createBills))
    .post(`${invoicePrefix}`, (req, res) => http(req, res, invoiceController.createInvoices))
    .put(`${invoicePrefix}/order/:orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, invoiceController.exportInvoice))
    .put(`${billPrefix}/order/:orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, billController.exportBill));

module.exports = router;