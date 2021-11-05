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
    .post(`${billPrefix}/:billGuid/line`, (req, res) => billController.createBillLine(req, res))
    .post(`${invoicePrefix}/:invoiceGuid/line`, (req, res) => invoiceController.createInvoiceLine(req, res))
    .put(`${invoicePrefix}/link/:line1Guid(${uuidRegexStr})/:line2Guid(${uuidRegexStr})`, (req, res) => invoiceController.LinkInvoiceLines(req, res))
    .put(`${invoicePrefix}/order/:orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, invoiceController.exportInvoice))
    .put(`${billPrefix}/order/:orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, billController.exportBill))
    .delete(`${invoicePrefix}/link/:line1Guid(${uuidRegexStr})/:line2Guid(${uuidRegexStr})`, (req, res) => invoiceController.UnLinkInvoiceLines(req, res));

module.exports = router;