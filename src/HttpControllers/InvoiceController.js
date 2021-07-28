const HttpRouteController = require('./HttpRouteController');
const InvoiceService = require('../Services/InvoiceService');

class InvoiceController extends HttpRouteController
{
    static async getInvoice(req, res)
    {

    }

    static async createInvoice(req, res)
    {

    }
}

const controller = new InvoiceController();

module.exports = controller;