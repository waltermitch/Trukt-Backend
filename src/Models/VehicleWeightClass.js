const BaseModel = require('./BaseModel');

class WeightClass extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.vehicleWeightClasses';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            vehicle: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./Vehicle'),
                join: {
                    from: 'rcgTms.vehicleWeightClasses.id',
                    to: 'rcgTms.vehicles.weightClassId'
                }
            }
        };
    }
}

module.exports = WeightClass;