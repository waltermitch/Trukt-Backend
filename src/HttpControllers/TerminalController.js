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
                const err = new Error('Missing search parameters.');
                err.status = 400;
                throw err;
            }
        }
        catch (err)
        {
            next(err);
        }
    }

    static async getByGuid(req, res)
    {
        let result = await TerminalService.getById(req.params.terminalGuid);
        let status;
        if (result.length > 0)
        {
            status = 200;
            result = result[0];
        }
        else
        {
            status = 404;
            result = undefined;
        }

        res.status(status);
        res.json(result);
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