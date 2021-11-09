const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');
const Commodity = require('./Commodity');

class OrderStopLink extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderStopLinks';
    }

    static get idColumn()
    {
        return ['orderGuid', 'stopGuid', 'commodityGuid'];
    }

    static get relationMappings()
    {
        return {
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.orderStopLinks.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            commodity: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderStopLinks.commodityGuid',
                    to: 'rcgTms.commodities.guid'
                }
            },
            stop: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderStopLinks.stopGuid',
                    to: 'rcgTms.orderStops.guid'
                }
            },
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.orderStopLinks.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            }
        };
    }

    static toStops(stopLinks)
    {
        const stopCache = {};

        for (const stopLink of stopLinks)
        {

            if (!(stopLink.stop.guid in stopCache))
            {
                const stop = stopLink.stop;
                stop.commodities = [];
                stopCache[stop.guid] = stop;
            }
            const stop = stopCache[stopLink.stop.guid];

            // dont want to reuse commodities, because can have different data per stoplink
            const commodity = Commodity.fromJson(stopLink.commodity);
            if (!(stop.commodities.find(it => it.guid == commodity.guid)))
                stop.commodities.push(commodity);
        }
        return Object.values(stopCache);
    }
}

Object.assign(OrderStopLink.prototype, RecordAuthorMixin);
module.exports = OrderStopLink;