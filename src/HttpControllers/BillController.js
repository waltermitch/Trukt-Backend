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

    static async deleteBillLine(req, res)
    {
        const billGuid = req.params.billGuid;
        const lineGuid = req.params.lineGuid;
        try
        {
            const result = await BillService.deleteBillLine(billGuid, lineGuid);
            res.status(200);
            res.json(result);
        }
        catch (error)
        {
            res.status(404);
            res.json(error.message);
        }
    }

    static async deleteBillLines(req, res)
    {
        const billGuid = req.params.billGuid;
        const lineGuids = req.body;
        try
        {
            const result = await BillService.deleteBillLines(billGuid, lineGuids);
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

    static async exportBill(req, res, next)
    {
        const { orderGuid } = req.params;

        try
        {
            const result = await BillService.exportBills([orderGuid]);

            const bill = result[orderGuid];

            // transform single element array to object
            bill.data = bill.data[0] || {};

            if (bill.errors.length > 0)
                res.status(400);
            else
                res.status(200);

            res.json(bill);
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = BillController;