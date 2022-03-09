const BillService = require('../Services/BillService');
const InvoiceLine = require('../Models/InvoiceLine');
const { NotFoundError } = require('../ErrorHandling/Exceptions');

class BillController
{
    static async getBill(req, res, next)
    {
        try
        {
            const result = await BillService.getBill(req.params.billGuid);
            if (result)
            {
                res.status(200);
                res.json(result);
            }
            else
            {
                throw new NotFoundError('Bill not found');
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async updateBillLine(req, res, next)
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
            next(error);
        }
    }

    static async deleteBillLine(req, res, next)
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
            next(error);
        }
    }

    static async deleteBillLines(req, res, next)
    {
        const billGuid = req.params.billGuid;
        const lineGuids = req.body;
        try
        {
            const result = await BillService.deleteBillLines(billGuid, lineGuids);
            const response = result?.toJSON() || {};
            res.status(response?.status ?? 200);
            res.json(response);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async createBillLine(req, res, next)
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
            next(error);
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

            bill.errors.throwErrorsIfExist();

            res.status(200).json(bill);
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = BillController;