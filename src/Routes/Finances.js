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

    .post(`${invoicePrefix}`, invoiceController.createInvoice)
    .post(`${billPrefix}/:billGuid/line`, billController.createBillLine)
    .post(`${invoicePrefix}/:invoiceGuid/line`, invoiceController.createInvoiceLine)

    .put(`${invoicePrefix}/link/:line1Guid(${uuidRegexStr})/:line2Guid(${uuidRegexStr})`, invoiceController.LinkInvoiceLines)
    .put(`${invoicePrefix}/order/:orderGuid(${uuidRegexStr})/export`, invoiceController.exportInvoice)
    .put(`${billPrefix}/order/:orderGuid(${uuidRegexStr})/export`, billController.exportBill)
    .put(`${billPrefix}/:billGuid(${uuidRegexStr})/line/:lineGuid(${uuidRegexStr})`, billController.updateBillLine)
    .put(`${invoicePrefix}/:invoiceGuid(${uuidRegexStr})/line/:lineGuid(${uuidRegexStr})`, invoiceController.updateInvoiceLine)

    .delete(`${billPrefix}/:billGuid/line/:lineGuid`, billController.deleteBillLine)
    .delete(`${invoicePrefix}/:invoiceGuid/line/:lineGuid`, invoiceController.deleteInvoiceLine)
    .delete(`${billPrefix}/:billGuid/lines`, billController.deleteBillLines)
    .delete(`${invoicePrefix}/:invoiceGuid/lines`, invoiceController.deleteInvoiceLines)
    .delete(`${invoicePrefix}/link/:line1Guid(${uuidRegexStr})/:line2Guid(${uuidRegexStr})`, invoiceController.UnLinkInvoiceLines);

module.exports = router;