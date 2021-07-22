const BaseModel = require('./BaseModel');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const { RecordAuthorMixin, AuthorRelationMappings } = require('./Mixins/RecordAuthors');

class Commodity extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.commodities';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relationships =
        {
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.commodities.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.commodityGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            commType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./CommodityType'),
                join: {
                    from: 'rcgTms.commodities.typeId',
                    to: 'rcgTms.commodityTypes.id'
                }
            },
            vehicle: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Vehicle'),
                join: {
                    from: 'rcgTms.commodities.vehicleId',
                    to: 'rcgTms.vehicles.id'
                }
            }
        };

        Object.assign(relationships, AuthorRelationMappings(Commodity.tableName));

        return relationships;
    }

    static get modifiers()
    {
        return {
            distinct(query)
            {
                // use distinctOn because we are using pg
                query.distinctOn('guid');
            }
        };
    }

    isVehicle()
    {
        return this.commType?.category === 'vehicle' || this.vehicle != undefined || this.vehicleId != undefined;
    }

    isFreight()
    {
        return this.commType?.category === 'freight' || this.vehicle == undefined && this.vehicleId == undefined;
    }

    setType(commType)
    {
        if (!commType)
        {
            throw new Error('invalid commodity type provided');
        }
        this.commType = commType;
        this.typeId = commType.id;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if (!(json?.typeId) && 'category' in json && 'type' in json)
        {
            json.commType = { category: json.category, type: json.type };
            delete json.category;
            delete json.type;
        }

        return json;
    }

    $formatDatabaseJson(json)
    {
        json = super.$formatDatabaseJson(json);

        delete json.commType;
        return json;
    }

    async $beforeInsert(queryContext)
    {
        await super.$beforeInsert(queryContext);

        // only keep the id
        delete this.commType;

        // index is used from external for creating
        delete this.index;
    }

    async $beforeUpdate(options, context)
    {
        await super.$beforeUpdate(options, context);

        // only keep the id
        delete this.commType;

        // index is used from external for creating
        delete this.index;
    }

}
Object.assign(Commodity.prototype, FindOrCreateMixin);
Object.assign(Commodity.prototype, RecordAuthorMixin);
module.exports = Commodity;