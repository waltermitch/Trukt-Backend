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
            
            const amount = Math.max(req.body.amount || 20, 1);
            const order = req.body.order || 'desc';
            const search = req.body.search || '';
            const popular = req.body.popular || false;
            const caseLabels = await CaseService.getAvailableCaseLabels(amount, order, search, popular);

            if (caseLabels)
            {
                res.status(200);
                res.json(caseLabels);
            }
            else
            {
                throw new NotFoundError('Case Label not found');
            }
        }
        catch (error)
        {
            next(error);
        }
    }
}

module.exports = CaseController;
