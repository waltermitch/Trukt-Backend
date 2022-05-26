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
            const subCaseLabelQuery =
                CaseLabel.query(trx)
                .select(CaseLabel.fetch.getCaseLabelsPayload)
                .where('label', 'ilike', `%${search}%`)
                .orWhere('description', 'ilike', `%${search}%`)
                .leftJoinRelated('stat');
                
            if (popular)
            {
                subCaseLabelQuery.orderBy('stat.count', order);
            }

            subCaseLabelQuery.page(0, amount);

            const baseCaseLabelQuery = CaseLabel.query().select('cl.*').from(subCaseLabelQuery.as('cl'));
            const resultQuery = baseCaseLabelQuery.orderBy('cl.label', 'asc');
            const results = await resultQuery;
            await trx.commit();
            return results;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }
    
    static async markCaseIsResolved(caseGuid, currentUser)
    {
        const [caseToChange] = await Promise.all([
            Case.query()
            .where({ 'guid': caseGuid })
            .first()
        ]);

        if (!caseToChange.isResolved)
        {
            await Promise.all([
                Case.query().patch({
                    'isResolved': true,
                    'resolvedByGuid': currentUser,
                    'dateResolved': DateTime.now()
                }).where('guid', caseGuid)
            ]);
        }
        
    }
}

module.exports = CaseService;
