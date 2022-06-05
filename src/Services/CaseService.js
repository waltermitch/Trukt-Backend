const { DateTime } = require('luxon');
const Case = require('../Models/Case');
const CaseLabel = require('../Models/CaseLabel');
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

    static async getNotes(caseGuid)
    {
        const trx = await Case.startTransaction();
        try
        {
            const res = await Case.query(trx).findById(caseGuid)
                .withGraphFetched('notes.createdBy');

            if (!res)
            {
                throw new NotFoundError(`Case with ${caseGuid} not found.`);
            }

            await trx.commit();
            return res.notes;
        }
        catch (error)
        {
            await trx.rollback();
            throw error;
        }
    }

    static async deleteCase(caseGuid, currentUser)
    {
        // Cases will be soft deleted, they will remain attached to the job.
        // We want to be able to keep track of which case was attached to which job even after deletion.
        // Querying for cases will require to query if the case is marked deleted or not.

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
                throw new NotFoundError('Case was not found and not deleted.');
            }

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
