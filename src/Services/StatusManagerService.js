const ActivityLog = require('../Models/ActivityLogs');

// DEPRICATED!!
class StatusManagerService
{
    static async getStatusLogs({ pg, rc, orderGuid, jobGuid })
    {
        const page = pg - 1;
        let baseQuery = ActivityLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations',
            'jobGuid'
        ])
            .page(page, rc)
            .where('order_guid', orderGuid);

        if (jobGuid)
            baseQuery = baseQuery.andWhere('jobGuid', jobGuid);

        baseQuery = baseQuery.withGraphFetched({
            user: true,
            activity: true
        })
            .modifyGraph('activity', builder => builder.select('id', 'name'))
            .orderBy('date_created', 'DESC');

        const statusLogResults = await baseQuery;

        statusLogResults.page = page + 1;
        statusLogResults.rowCount = rc;
        return statusLogResults;
    }
}

module.exports = StatusManagerService;