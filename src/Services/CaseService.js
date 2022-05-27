const { DateTime } = require('luxon');
const Case = require('../Models/Case');
const CaseLabel = require('../Models/CaseLabel');

class CaseService
{
    static async getAvailableCaseLabels(amount, order, search, popular)
    {
        const trx = await CaseLabel.startTransaction();
        try
        {
            let query =
                CaseLabel.query(trx)
                    .select(CaseLabel.fetch.getCaseLabelsPayload)
                    .limit(amount, { skipBinding: true });

            if (search)
            {
                query.where('label', 'ilike', `%${search}%`)
                    .orWhere('description', 'ilike', `%${search}%`);
            }

            if (popular)
            {
                const innerQuery = query;
                innerQuery.leftJoinRelated('stat')
                    .orderBy('stat.count', order);
                query = CaseLabel.query(trx).from(innerQuery.as('cl'));
            }

            query.orderBy('label', 'asc');
            const results = await query;
            await trx.commit();
            return results;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }
    
    static async caseResolve(caseGuid, currentUser)
    {
        const [caseToChange] = await Promise.all([
            Case.query()
            .where({ 'guid': caseGuid })
            .first()
        ]);

        if (!caseToChange.isResolved)
        {
            caseToChange.isResolved = true;
            caseToChange.resolvedByGuid = currentUser;
            caseToChange.dateResolved = DateTime.now();

            await Case.query().patch(caseToChange).findById(caseToChange.guid);
        }
        return;
        
    }
}

module.exports = CaseService;
