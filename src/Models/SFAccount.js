const BaseModel = require('./BaseModel');
const { raw } = require('objection');

class SFAccount extends BaseModel
{
    static get tableName()
    {
        return 'salesforce.accounts';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const SFContact = require('./SFContact');
        return {
            contacts: {
                relation: BaseModel.HasManyRelation,
                modelClass: SFContact,
                join: {
                    from: 'salesforce.accounts.sfId',
                    to: 'salesforce.contacts.accountId'
                }
            },
            primaryContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'salesforce.accounts.primaryContactId',
                    to: 'salesforce.contacts.sfId'
                }
            },
            rectype: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./RecordType'),
                join: {
                    from: 'salesforce.accounts.recordTypeId',
                    to: 'salesforce.record_types.sfId'
                }
            }
        };
    }

    static modifiers = {
        byType(query, type)
        {
            const qb = query.leftJoinRelated('rectype');

            if (type === 'client')
            {
                qb.select(raw('\'client\' as rtype'), 'salesforce.accounts.*');
                qb.where(builder =>
                {
                    builder.orWhere('rectype.name', 'ilike', 'client');
                    builder.orWhere('rectype.name', 'ilike', 'person account');
                });
            }
            else
            {
                qb.select('rectype.name as rtype', 'salesforce.accounts.*');
                qb.where('rectype.name', 'ilike', type);
            }

            return qb;
        }
    }

    /**
     * this is to send the object to external source
     */
    $formatJson(json)
    {
        json = super.$formatJson(json);

        // based on rtype
        if ('rtype' in json)
        {
            json.rtype = json.rtype.toLowerCase();

            switch (json.rtype)
            {
                case 'client':
                    delete json.dotNumber;
                    delete json.referralAmount;
                    delete json.mcNumber;
                    delete json.preferred;
                    delete json.blacklist;
                    break;
                case 'carrier':
                    delete json.loadboardInstructions;
                    delete json.orderInstructions;

                    break;
                case 'employee':
                    delete json.referralAmount;
                case 'referrer':
                    delete json.preferred;
                    delete json.blacklist;
                    delete json.dotNumber;
                    for (const field of [
                        'Street',
                        'State',
                        'PostalCode',
                        'Longitude',
                        'Latitude',
                        'GeocodeAccuracy',
                        'Country',
                        'City'
                    ])

                        for (const type of ['billing', 'shipping'])

                            delete json[type + field];

                    delete json.orderInstructions;
                    delete json.loadboardInstructions;
                    delete json.mcNumber;
                    break;
            }
        }
        return json;
    }
}

module.exports = SFAccount;