const { DateTime } = require('luxon');
const Case = require('../Models/Case');
const CaseLabel = require('../Models/CaseLabel');
const Notes = require('../Models/Notes');

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

    static async getNotes(caseGuid, currentUser)
    {
        const trx1 = await Notes.startTransaction();
        const trx = await Case.startTransaction();
        try 
        {
            const res = await Case.query(trx).where('guid', caseGuid).leftJoinRelated('notes').withGraphFetched('notes.createdBy').select('notes.*');
                
            const res1 = await Notes.query(trx)
                .select('genericNotes.*')
                .leftJoinRelated('case')
                .where('case.guid', caseGuid)
                .withGraphFetched('createdBy');
            console.log('res====', res);   
            await trx.commit();
            return res1;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
        
    }
}

module.exports = CaseService;
