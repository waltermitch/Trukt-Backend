const BaseModel = require('./BaseModel');

class OrderStop extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderStops';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        return {
            terminal: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Terminal'),
                join: {
                    from: 'rcgTms.orderStops.terminalGuid',
                    to: 'rcgTms.terminals.guid'
                }
            },
            primaryContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Contact'),
                join: {
                    from: 'rcgTms.orderStops.primaryContactGuid',
                    to: 'rcgTms.contacts.guid'
                }
            },
            alternativeContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Contact'),
                join: {
                    from: 'rcgTms.orderStops.alternativeContactGuid',
                    to: 'rcgTms.contacts.guid'
                }
            }
        };
    }
}

module.exports = OrderStop;