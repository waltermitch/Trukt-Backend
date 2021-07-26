const BaseModel = require('./BaseModel');

class EquipmentType extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.equipmentTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    static get relationMappings()
    {
        return {
            jobs: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.equipmentTypes.id',
                    to: 'rcgTms.orderJobs.equipmentTypeId'
                }
            }
        };
    }
}

module.exports = EquipmentType;