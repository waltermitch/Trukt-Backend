const CaseLabel = require('../Models/CaseLabel');

class CaseService
{
    static async getAvailableCaseLabels(amount, order, search, popular)
{
        const trx = await CaseLabel.startTransaction();
        
        try
        {
            const baseCaseLabelQuery =
                CaseLabel.query(trx)
                .select(CaseLabel.fetch.getCaseLabelsPayload)
                .where('label', 'ilike', `%${search}%`)
                .orWhere('description', 'ilike', `%${search}%`)
                .leftJoinRelated('stat')
                .orderBy('label', order);
            if(popular)
            {
                baseCaseLabelQuery.orderBy('stat.count', 'desc');
            }

                baseCaseLabelQuery.page(0, amount);
            const { results } = await baseCaseLabelQuery;
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
