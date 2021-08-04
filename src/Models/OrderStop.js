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
                modelClass: require('./TerminalContact'),
                join: {
                    from: 'rcgTms.orderStops.primaryContactGuid',
                    to: 'rcgTms.terminalContacts.guid'
                }
            },
            alternativeContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./TerminalContact'),
                join: {
                    from: 'rcgTms.orderStops.alternativeContactGuid',
                    to: 'rcgTms.terminalContacts.guid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderStops.guid',
                    through: {
                        modelClass: require('./OrderStopLink'),
                        from: 'rcgTms.orderStopLinks.stopGuid',
                        to: 'rcgTms.orderStopLinks.commodityGuid'
                    },
                    to: 'rcgTms.commodities.guid'
                }
            }
        };
    }

    static get modifiers()
    {
        return {
            filterDistinct(builder)
            {
                // use distinctOn because we are using pg
                builder.distinctOn('guid');
            }
        };
    }
}

module.exports = OrderStop;