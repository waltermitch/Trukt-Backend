const BaseModel = require('./BaseModel');
const CommodityType = require('./CommodityType');
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

    isVehicle()
    {
        return this.commType?.category === 'vehicle' || this.vehicle != undefined || this.vehicleId != undefined;
    }

    isFreight()
    {
        return this.commType?.category === 'freight' || this.vehicle == undefined && this.vehicleId == undefined;
    }

    /**
     * Sets the commodity type id on this commodity
     */
    async setCommTypeId()
    {
        const commType = await this.getCommType();
        if (!this.typeId)
        {
            this.typeId = commType.id;
        }
    }

    async getCommType()
    {
        const commTypes = await CommodityType.types();
        let found = undefined;
        const category = this.commType?.category;
        const type = this.commType?.type;

        if (this.typeId)
        {
            found = commTypes.find(it => it.id == this.typeId);
        }
        else
        {
            found = commTypes.find(it => it.category === category && it.type === type);
        }

        if (!found)
        {
            throw new Error('Invalid commodity type provided: ' + (this.typeId || `${category} ${type}`));
        }

        return found;
    }

    /**
     * Sets the commodity name field
     * automatically generates the name if the user didn't supply a name
     */
    async setName()
    {
        const commType = this.commType || await this.getCommType();
        if (!this.name)
        {
            let names = [];
            switch (commType.category)
            {
                case 'vehicle':
                    for (const fname of ['year', 'make', 'model'])
                        if (this.vehicle?.[fname])
                            names.push(this.vehicle[fname]);
                    break;
                case 'freight':
                    names = [this.quantity, commType.type];
                    if (this.weight)
                        names.push(this.weight + ' lbs');
                    break;
                default:
                    names = [this.quantity, commType.category];
            }
            this.name = names.join(' ').trim();
        }
        if (!this.name)
        {
            const category = this.quantity > 1 && commType.category === 'vehicle' ? 'vehicles' : commType.category;
            this.name = [this.quantity > 1 ? this.quantity : '', category, commType.type].join(' ');
        }
        this.name = this.name.replace(/\s+/g, ' ').trim();
    }

    async setDescription()
    {
        if (!this.description)
        {
            await this.setName();
            this.description = this.name;
            if (!this.description)
            {
                this.description = 'no description provided';
            }
        }
    }

    $parseJson(json)
    {
        console.log(json);
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
        await this.setCommTypeId();
        await this.setName();
        await this.setDescription();

        // only keep the id
        delete this.commType;

        // index is used from external for creating
        delete this.index;
    }

    async $beforeUpdate(options, context)
    {
        await super.$beforeUpdate(options, context);
        await this.setCommTypeId();
        await this.setName();
        await this.setDescription();

        // only keep the id
        delete this.commType;

        // index is used from external for creating
        delete this.index;
    }

}
Object.assign(Commodity.prototype, FindOrCreateMixin);
Object.assign(Commodity.prototype, RecordAuthorMixin);
module.exports = Commodity;