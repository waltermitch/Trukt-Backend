const HttpRouteController = require('./HttpRouteController');
const IndexNumberService = require('../Services/IndexNumberService');
const { orderNumberRegex } = require('../Utils/Regexes');

class IndexNumberController extends HttpRouteController
{

    static async nextOrderNumber(req, res, next)
    {
        try
        {
            const result = await IndexNumberService.nextOrderNumber();
            res.status(200);
            res.json({ orderNumber: result });

        }
        catch (err)
        {
            next(err);
        }
    }

    static async nextJobNumber(req, res, next)
    {
        if (req.query?.order)
        {
            if (orderNumberRegex.test(req.query.order))
            {
                try
                {
                    const result = await IndexNumberService.nextJobNumber(req.query.order);
                    res.status(200);
                    res.json({ jobNumber: result });

                }
                catch (err)
                {
                    next(err);
                }
            }
            else
            {
                res.status(400);
                res.send('invalid order number');
            }
        }
        else
        {
            res.status(400);
            res.send('missing order number');
        }
    }

    async handleGet(context, req)
    {
        const res = {};

        switch (req.params.objectType)
        {
            case 'order':
                const orderNum = await IndexNumberService.nextOrderNumber();
                res.body = { orderNumber: orderNum };
                break;
            case 'job':
                if (orderNumberRegex.test(req.query.order))
                {
                    const jobNum = await IndexNumberService.nextJobNumber(req.query.order, req.query.count);
                    res.body = { jobNumber: jobNum };
                }
                else
                {
                    res.status = 400;
                    res.body = 'invalid order number';
                }
                break;
            default:
                res.status = 400;
        }

        return res;

    }
}

const controller = new IndexNumberController();
module.exports = controller;