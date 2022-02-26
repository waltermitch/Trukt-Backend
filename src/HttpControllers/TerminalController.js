const { MissingDataError, NotFoundError } = require('../ErrorHandling/Exceptions');
const TerminalService = require('../Services/TerminalService');
const { uuidRegex } = require('../Utils/Regexes');

const searchableFields = [
    'search',
    'name',
    'address',
    'city',
    'state',
    'country',
    'lat',
    'long',
    'zip'
];

class TerminalController
{
    static async search(req, res, next)
    {
        try
        {
            const queryFields = Object.keys(req.query || {});
            if (searchableFields.reduce((acc, value) => { return acc || queryFields.includes(value); }, false))
            {
                const result = await TerminalService.search(req.query);
                res.status(200);
                res.json(result);
            }
            else
            {
                throw new MissingDataError('Missing search parameters.');
            }
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

    searchQueryCriteria(query)
    {
        const clone = Object.assign({}, query);
        delete clone.pg;
        delete clone.rc;
        return Object.keys(clone).length > 0;
    }
}

module.exports = TerminalController;