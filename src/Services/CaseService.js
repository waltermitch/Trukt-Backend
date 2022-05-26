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
    
}

module.exports = CaseService;
