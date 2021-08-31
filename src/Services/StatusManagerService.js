const Order = require('../Models/Order');
const User = require('../Models/User');
const StatusLog = require('../Models/StatusLog');
const StatusLogType = require('../Models/StatusLogType');

class StatusManagerService
{

    /**
     *
     * @param userGuid required
     * @param orderGuid required
     * @param statusId required, id from status_log_types table
     * @param extraAnnotations optional, json with extra information to add in the log
     * @returns new log ID added
     */
    static async createStatusLog({ userGuid, orderGuid, statusId, extraAnnotations })
    {
        const trx = await StatusLog.startTransaction();

        try
        {
            StatusManagerService.validateCreateStatusLogInput({ userGuid, orderGuid, statusId });
            await StatusManagerService.checkCreateStatusLogConstraints(trx, userGuid, orderGuid, statusId);

            const statusManager = StatusLog.fromJson({
                userGuid,
                orderGuid,
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

    static async checkCreateStatusLogConstraints(trx, userGuid, orderGuid, statusLogTypeId)
    {
        const [user, order, statusLogType] =
            await Promise.all([User.query(trx).findById(userGuid), Order.query(trx).findById(orderGuid), StatusLogType.query(trx).findById(statusLogTypeId)]);

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

        return [user, order, statusLogType];
    }

    static async getStatusLogs({ page = 0, rowCount = 25, orderGuid })
    {
        const statusLogResults = await StatusLog.query().select([
            'id',
            'orderGuid',
            'dateCreated',
            'extraAnnotations'
        ]).page(page, rowCount)
            .where('order_guid', orderGuid)
            .withGraphFetched({
                user: true,
                status: true
            })
            .modifyGraph('status', builder => builder.select('id', 'name'))
            .orderBy('date_created', 'DESC');

        statusLogResults.page = page;
        statusLogResults.rowCount = rowCount;
        return statusLogResults;
    }

    static validateCreateStatusLogInput({
        orderGuid,
        userGuid,
        statusId
    })
    {
        const input = {
            orderGuid: orderGuid || null,
            userGuid: userGuid || null,
            statusId: statusId || null
        };

        const isInputInvalid = Object.values(input).some(value => !value);

        if (isInputInvalid)
        {
            throw 'Invalid status log input';
        }
    }
}

module.exports = StatusManagerService;