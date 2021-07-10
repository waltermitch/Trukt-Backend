const BaseModel = require('./BaseModel');
const Order = require('./Order');

class OrderJob extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobs';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.orderJobs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            }

            // loadboardPosts: {
            //     relation: BaseModel.HasManyRelation,
            //     modelclass: LoadboardPost,
            //     join: {
            //         from: 'rcgTms.orderJobs.guid',
            //         to: 'rcgTms.loadboardPosts.job'
            //     }
            // }
        };
    }
}

module.exports = OrderJob;