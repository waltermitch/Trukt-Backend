const StatusLogType = require('../Models/StatusLogType');
const StatusLog = require('../Models/StatusLog');
const OrderJob = require('../Models/OrderJob');
const Order = require('../Models/Order');
const User = require('../Models/User');

class StatusManagerService
{

    /**
     *
     * @param userGuid required
     * @param orderGuid required
     * @param jobGuid required
     * @param statusId required, id from status_log_types table
     * @param extraAnnotations optional, json with extra information to add in the log
     * @returns new log ID added
     */
    static async createStatusLog({ userGuid, orderGuid, statusId, extraAnnotations, jobGuid })
    {
        const trx = await StatusLog.startTransaction();

        try
        {
            StatusManagerService.validateCreateStatusLogInput({ userGuid, orderGuid, statusId, jobGuid });
            await StatusManagerService.checkCreateStatusLogConstraints(trx, userGuid, orderGuid, jobGuid, statusId);

            const statusManager = StatusLog.fromJson({
                userGuid,
                orderGuid,
                jobGuid,
                statusId,
                extraAnnotations
            });

            const { id } = await StatusLog.query(trx).skipUndefined()
                .insert(statusManager, {
                    allowRefs: true
                }).returning('id');

            await trx.commit();

            return { id };
        }
        catch (err)
        {
            await trx.rollback();
            throw err;
        }
    }

    static async checkCreateStatusLogConstraints(trx, userGuid, orderGuid, jobGuid, statusLogTypeId)
    {
        const [
            user,
            order,
            statusLogType,
            job
        ] =
            await Promise.all([
                User.query(trx).findById(userGuid),
                Order.query(trx).findById(orderGuid),
                StatusLogType.query(trx).findById(statusLogTypeId),
                OrderJob.query(trx).findById(jobGuid)
            ]);

        if (!user)
        {
            throw new Error(`User ${userGuid} doesnt exist`);
        }
        if (!order)
        {
            throw new Error(`Order ${orderGuid} doesnt exist`);
        }
        if (!statusLogType)
        {
            throw new Error(`Status type ${statusLogTypeId} doesnt exist`);
        }
        if (!job)
        {
            throw new Error(`Order job ${job} doesnt exist`);
        }

        return [
            user,
            order,
            statusLogType,
            job
        ];
    }

    static async getStatusLogs({ pg, rc, orderGuid, jobGuid })
    {
        const page = pg - 1;
        let baseQuery = StatusLog.query().select([
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
            status: true
        })
            .modifyGraph('status', builder => builder.select('id', 'name'))
            .orderBy('date_created', 'DESC');

        const statusLogResults = await baseQuery;

        statusLogResults.page = page + 1;
        statusLogResults.rowCount = rc;
        return statusLogResults;
    }

    static validateCreateStatusLogInput({
        orderGuid,
        userGuid,
        statusId,
        jobGuid
    })
    {
        const input = {
            orderGuid: orderGuid || null,
            userGuid: userGuid || null,
            statusId: statusId || null,
            jobGuid: jobGuid || null
        };

        const isInputInvalid = Object.values(input).some(value => !value);

        if (isInputInvalid)
        {
            throw 'Invalid status log input';
        }
    }
}

module.exports = StatusManagerService;