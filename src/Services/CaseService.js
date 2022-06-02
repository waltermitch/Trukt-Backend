const { DateTime } = require('luxon');
const Case = require('../Models/Case');
const CaseLabel = require('../Models/CaseLabel');
const OrderJobCase = require('../Models/OrderJobCase');
const { NotFoundError } = require('../ErrorHandling/Exceptions');
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
        const trx = await Case.startTransaction();

        try
        {
            await Case.query(trx).patch({
                isResolved: true,
                resolvedByGuid: currentUser,
                dateResolved: DateTime.now(),
                updatedByGuid: currentUser
            })
                .findById(caseGuid)
                .where({ isResolved: false });

            await trx.commit();
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async deleteCase(caseGuid, currentUser)
    {
        const trx = await Case.startTransaction(); 
        
        try
        {
            const updatedCase = await Case.query(trx)
                .findById(caseGuid)
                .patch({
                    isDeleted: true,
                    dateDeleted: DateTime.now(),
                    updatedByGuid: currentUser,
                    deletedByGuid: currentUser
                });
            

            if (!updatedCase) 
            {
                trx.rollback();
                throw new NotFoundError('Case was not found and not deleted');
            }
            await OrderJobCase.query().delete().where('caseGuid', caseGuid);
            
            await trx.commit();
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
        
    }
}

module.exports = CaseService;
