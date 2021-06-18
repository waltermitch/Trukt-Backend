const TerminalService = require('../Services/TerminalService');
const HttpRouteController = require('./HttpRouteController');
const { uuidRegex } = require('../Utils/Regexes');

class TerminalController extends HttpRouteController
{
    async handleGet(context, req)
    {
        const res = {};

        if (!('terminalId' in req.params) && this.searchQueryCriteria(req.query))
        {
            res.body = await TerminalService.search(req.query);
            res.status = 200;
        }
        else if (uuidRegex.test(req.params.terminalId))
        {
            const result = await TerminalService.getById(req.params.terminalId);
            if (result.length > 0)
            {
                res.status = 200;
                res.body = result[0];
            }
            else
            {
                res.status = 404;
            }
        }
        else
        {
            res.status = 400;
        }
        return res;
    }

    searchQueryCriteria(query)
    {
        const clone = Object.assign({}, query);
        delete clone.pg;
        delete clone.rc;
        return Object.keys(clone).length > 0;
    }
}

const controller = new TerminalController();
module.exports = controller;