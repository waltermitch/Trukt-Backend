const HttpRouteController = require('./HttpRouteController');
const IndexNumberService = require('../Services/IndexNumberService');
const { orderNumberRegex } = require('../Utils/Regexes');

class IndexNumberController extends HttpRouteController
{
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