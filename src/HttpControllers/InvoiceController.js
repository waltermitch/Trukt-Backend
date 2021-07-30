const HttpRouteController = require('./HttpRouteController');
const InvoiceService = require('../Services/InvoiceService');

class InvoiceController extends HttpRouteController
{
    static async getInvoice(req, res)
    {

    }

    static async createInvoices(req, res)
    {

    }
}

const controller = new InvoiceController();

module.exports = controller;