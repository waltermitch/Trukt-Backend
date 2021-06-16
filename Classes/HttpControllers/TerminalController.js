const { uuidRegex } = require('../Utils/Regexes');
const TerminalService = require('../Services/TerminalService');
const HttpRouteController = require('./HttpRouteController');

class TerminalController extends HttpRouteController
{
    async handleGet(context, request)
    {
        if (!('terminalId' in request.params) && ('search' in request.query))
        {
            context.res.body = await TerminalService.search(request.query.search);
        }
        else if (uuidRegex.test(request.params.terminalId))
        {
            const result = await TerminalService.getById(request.params.terminalId);
            this.onlyOne(context, result);
        }
        else
        {
            context.res.status = 400;
        }

    }
}

const controller = new TerminalController();
module.exports = controller;