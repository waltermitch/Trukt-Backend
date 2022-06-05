const CaseService = require('../Services/CaseService');
const {
    NotFoundError
} = require('../ErrorHandling/Exceptions');

class CaseController
{
    static async getCaseLabels(req, res, next)
    {
        try
        {

            const amount = Math.max(req.query.amount || 20, 1);
            const order = req.query.order || 'desc';
            const search = req.query.search || '';
            const popular = req.query.popular || false;
            const caseLabels = await CaseService.getAvailableCaseLabels(amount, order, search, popular);

            if (caseLabels)
            {
                res.status(200);
                res.json(caseLabels);
            }
            else
            {
                res.status(200);
                res.json([]);
            }
        }
        catch (error)
        {
            next(error);
        }
    }

    static async caseResolve(req, res, next)
    {
        try
        {
            await CaseService.caseResolve(req.params.guid, req.session.userGuid);
            res.status(204);
            res.json();
        }
        catch (error)
        {
            next(error);
        }
    }

    static async getNotes(req, res, next)
    {
        try
        {
            const response = await CaseService.getNotes(req.params.guid);
            res.status(200);
            res.json(response);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async deleteCase(req, res, next)
    {
        try
        {
            await CaseService.deleteCase(req.params.caseGuid, req.session.userGuid);
            res.status(200);
            res.send();
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = CaseController;
