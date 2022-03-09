const { NotFoundError } = require('../ErrorHandling/Exceptions');
const TerminalService = require('../Services/TerminalService');
const { uuidRegex } = require('../Utils/Regexes');

class TerminalController
{
    static async search(req, res, next)
    {
        try
        {
            const result = await TerminalService.search(req.query);

            res.status(200);
            res.json(result);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async getByGuid(req, res, next)
    {
        try
        {
            const result = await TerminalService.getById(req.params.terminalGuid);

            if (result.length > 0)
                res.status(200).json(result[0]);
            else
                throw new NotFoundError('Terminal not found.');

        }
        catch (error)
        {
            next(error);
        }
    }

    static async update(req, res, next)
    {
        try
        {
            const result = await TerminalService.patchTerminal(req.params.terminalGuid, req.body, req.session.userGuid);

            res.status(200).json(result);
        }
        catch (err)
        {
            next(err);
        }
    }
}

module.exports = TerminalController;