const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

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
                        to: 'rcgTms.orderStopLinks.commodityGuid',
                        extra: ['lotNumber']
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },
            links: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderStopLink'),
                join: {
                    from: 'rcgTms.orderStops.guid',
                    to: 'rcgTms.orderStopLinks.stopGuid'
                }
            }
        };
    }

    static get modifiers()
    {
        return {
            distinct(builder)
            {
                // use distinctOn because we are using pg
                builder.distinctOn('guid');
            }
        };
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if ('index' in json)
        {
            json['#id'] = json.index;
            delete json.index;
        }
        return json;
    }

    setIndex(index)
    {
        const newIndex = 'order_stop_' + Date.now() + index;
        super.setIndex(newIndex);
    }

    static hasContact(stop)
    {
        return !(!(stop.primaryContact || stop.alternativeContact));
    }

    static firstAndLast(stops = [])
    {
        stops.sort((a, b) => (a.sequence < b.sequence));

        return [stops[0], stops[stops.length - 1]];
    }
}

Object.assign(OrderStop.prototype, RecordAuthorMixin);
module.exports = OrderStop;