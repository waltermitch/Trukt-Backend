const { RecordAuthorMixin, AuthorRelationMappings, isNotDeleted } = require('./Mixins/RecordAuthors');
const FindOrCreateMixin = require('./Mixins/FindOrCreate');
const BaseModel = require('./BaseModel');

// used for flattening the commodity in/out api
const vehicleFields = [
    'year',
    'make',
    'model',
    'trim'
];

const commTypeFields = ['category', 'type'];

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
            order: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: require('./Order'),
                join: {
                    from: 'rcgTms.commodities.guid',
                    through:
                    {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.commodityGuid',
                        to: 'rcgTms.orderStopLinks.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
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
        const modifiers = {
            distinct(query)
            {
                // use distinctOn because we are using pg
                query.distinctOn('guid');
            }
        };
        Object.assign(modifiers, isNotDeleted(Commodity.tableName));
        return modifiers;
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

    setVehicle(vehicle)
    {
        if (!vehicle)
        {
            throw new Error('invalid commodity vehicle provided');
        }
        this.vehicle = vehicle;
        this.vehicleId = vehicle.id;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if (!(json?.commType))
        {
            // inflate the commodity from api
            const commType = commTypeFields.reduce((commType, field) =>
            {
                if (field in json)
                {
                    commType[field] = json[field];
                    delete json[field];
                }
                return commType;
            }, {});

            if (json.typeId)
            {
                commType.id = json.typeId;
                delete json.typeId;
            }

            if (Object.keys(commType).length > 0)
            {
                json.commType = commType;
            }
        }

        if (!(json?.vehicle))
        {
            // vehicle is flat from api so unflatten it
            const vehicle = vehicleFields.reduce((vehicle, field) =>
            {
                if (field in json)
                {
                    vehicle[field] = json[field];
                    delete json[field];
                }
                return vehicle;
            }, {});

            if (json.vehicleId)
            {
                vehicle.id = json.vehicleId;
                delete json.vehicleId;
            }

            if (Object.keys(vehicle).length > 0)
            {
                json.vehicle = vehicle;
            }
        }

        this.mapIndex(json);

        return json;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);

        // flatten the vehicle when sending out to api
        if (json?.vehicle)
        {
            delete json.vehicle.id;
            Object.assign(json, json.vehicle);
        }
        delete json.vehicle;

        // flatten the commType when sending out to api
        if (json?.commType)
        {
            if (json.commType.id)
            {
                json.typeId = json.commType.id;
            }
            delete json.commType.id;
            Object.assign(json, json.commType);
        }
        delete json.commType;

        return json;
    }

    $formatDatabaseJson(json)
    {
        json = super.$formatDatabaseJson(json);

        delete json.commType;
        delete json.stopGuid;
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

    /**
     * @description This is for EDI orders that do not provide the description on the commodity
     */
    setDefaultDescription(isEdi = false)
    {
        if (isEdi && !this.description)
            this.description = this.identifier || 'not provided';
    }

}
Object.assign(Commodity.prototype, FindOrCreateMixin);
Object.assign(Commodity.prototype, RecordAuthorMixin);
module.exports = Commodity;