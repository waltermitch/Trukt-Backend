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
                modelClass: require('./SFRecordType'),
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

            switch (type)
            {
                case 'client':
                    qb.select(raw('\'client\' as rtype'), 'salesforce.accounts.*');
                    qb.where(builder =>
                    {
                        builder.orWhere('rectype.name', 'ilike', 'client');
                        builder.orWhere('rectype.name', 'ilike', 'person account');
                    });
                    break;
                case 'dispatcher':
                    qb.select(raw('\'employee\' as rtype'), 'salesforce.accounts.*');
                    qb.where('rectype.name', 'ilike', 'employee')
                        .where('salesforce.accounts.userRole', 'ilike', 'dispatcher');
                    break;
                default:
                    qb.select('rectype.name as rtype', 'salesforce.accounts.*');
                    qb.where('rectype.name', 'ilike', type);
            }

            return qb;
        },
        byId(query, id)
        {
            query.where(query =>
            {
                query.orWhere('salesforce.accounts.guid', id)
                    .orWhere('salesforce.accounts.sfId', id);
            });
        },
        carrier(query)
        {
            const qb = query.leftJoinRelated('rectype');
            qb.select(raw('\'carrier\' as rtype'), 'salesforce.accounts.*');
            qb.where({ 'rectype.name': 'Carrier' });
            return qb;
        },
        client(query, id)
        {
            query.modify('byType', 'client')
                .findOne((builder) =>
                {
                    builder.orWhere('guid', id).orWhere('salesforce.accounts.sfId', id);
                });
        },
        bySomeId(query, id)
        {
            query.findOne((builder) =>
            {
                builder.orWhere('guid', id).orWhere('salesforce.accounts.sfId', id);
            });
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
                case 'dispatcher':
                case 'employee':
                    delete json.referralAmount;
                case 'referrer':
                    for (const field of [
                        'preferred',
                        'blacklist',
                        'dotNumber',
                        'qbId',
                        'scId',
                        'sdGuid',
                        'status',
                        'syncInSuper',
                        'sfId'
                    ])
                    {
                        delete json[field];
                    }

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

    linkRecordType(recType)
    {
        this.recordTypeId = recType.sfId;
    }

    linkPrimaryContact(contact)
    {
        this.primaryContactId = contact.sfId;
    }

}

module.exports = SFAccount;