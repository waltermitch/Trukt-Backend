const invoiceController = require('../HttpControllers/InvoiceController.js');
const billController = require('../HttpControllers/BillController.js');
const { uuidRegexStr } = require('../Utils/Regexes');
const router = require('express').Router();

router
    .put(`/invoice/order/orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, invoiceController.exportInvoice))
    .put(`/bill/order/orderGuid(${uuidRegexStr})/export`, (req, res) => http(req, res, billController.exportBill));

module.exports = router;