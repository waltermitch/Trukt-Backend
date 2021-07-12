const BaseModel = require('./BaseModel');

class Vehicle extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.vehicles';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            commodities: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.vehicles.id',
                    to: 'rcgTms.commodities.vehicleId'
                }
            }
        };
    }
}

module.exports = Vehicle;