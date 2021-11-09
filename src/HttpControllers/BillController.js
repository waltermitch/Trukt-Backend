const BillService = require('../Services/BillService');
const InvoiceLine = require('../Models/InvoiceLine');

class BillController
{
    static async getBill(req, res)
    {
        const result = await BillService.getBill(req.params.billGuid);
        if (result)
        {
            res.status(200);
            res.json(result);
        }
        else
        {
            res.status(404);
            res.send();
        }
    }

    static async updateBillLine(req, res)
    {
        const billGuid = req.params.billGuid;
        const lineGuid = req.params.lineGuid;
        const line = InvoiceLine.fromJson(req.body);
        try
        {
            const result = await BillService.updateBillLine(billGuid, lineGuid, line);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async createBillLine(req, res)
    {
        const billGuid = req.params.billGuid;
        const invoiceGuid = (req.body.invoiceGuid || null);
        const currentUser = req.session.userGuid;
        const line = InvoiceLine.fromJson(req.body);
        delete line.invoiceGuid;
        try
        {
            const result = await BillService.addBillLine(billGuid, invoiceGuid, line, currentUser);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            if (error.message == 'Cannot link transport items!')
            {
                res.status(406);
                res.json(error.message);
            }
            else
            {
                res.status(404);
                res.json(error.message);
            }
        }
    }

    static async exportBill(req, res)
    {
        const orders = [req.params.orderGuid];

        const result = (await BillService.exportBills(orders))?.[0];

        if (result)
        {
            if (result.error)
                res.status(400);
            else
                res.status(200);

            res.json(result);
        }
        else
        {
            res.status(404);
            res.json({ 'error': 'Order Not Found' });
        }
    }

    static async exportBills(req, res)
    {
        const orders = req.body?.orders;

        if (!orders || orders == 0)
        {
            res.status(400);
            res.json({ 'error': 'Missing Or Empty Array' });
        }
        else
        {
            const result = await BillService.exportBills(orders);

            if (result)
            {
                res.status(200);
                res.json(result);
            }
            else
            {
                res.status(404);
                res.json({ 'error': 'Order Not Found' });
            }
        }
    }
}

module.exports = BillController;