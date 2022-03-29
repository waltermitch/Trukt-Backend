const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');

class OrderStop extends BaseModel
{
    static TYPES = {
        PICKUP: 'pickup',
        DELIVERY: 'delivery',
        SERVICE: null
    };

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
            },

            // This modifier exists because it is needed for calculating stop distances.
            // It is used as a builder object modifier. Use can be seen in Order model
            distinctAllData(builder)
            {
                builder.distinctOn('guid').select('*');
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
        stops.sort(OrderStop.sortBySequence);

        return [stops[0], stops[stops.length - 1]];
    }

    static removeContact(stop)
    {
        return stop.primaryContact === null || stop.alternativeContact === null;
    }

    // type = requested, estimated, scheduled
    setDates(type, dateType, startDate, endDate)
    {
        this[`date${type}Type`] = dateType;
        this[`date${type}Start`] = startDate;
        this[`date${type}End`] = endDate;
    }

    setRequestedDates(dateType, startDate, endDate)
    {
        this.setDates('Requested', dateType, startDate, endDate);
    }
    setEstimatedDates(dateType, startDate, endDate)
    {
        this.setDates('Estimated', dateType, startDate, endDate);
    }
    setScheduledDates(dateType, startDate, endDate)
    {
        this.setDates('Scheduled', dateType, startDate, endDate);
    }

    static get contactTypes()
    {
        return ['primaryContact', 'alternativeContact'];
    }

    static get sortBySequence()
    {
        return (firstStop, secondStop) => firstStop.sequence - secondStop.sequence;
    }

    static get filterDelivery()
    {
        return it => it.isDelivery;
    }

    get isPickup()
    {
        return this.stopType == 'pickup';
    }

    get isDelivery()
    {
        return this.stopType == 'delivery';
    }
}

Object.assign(OrderStop.prototype, RecordAuthorMixin);
module.exports = OrderStop;