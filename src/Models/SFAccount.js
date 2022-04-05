const { NotFoundError, DataConflictError } = require('../ErrorHandling/Exceptions');
const FieldFilters = require('./ModelFieldMappers.json').SFAccount;
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
        },
        externalIdandDot(query, id, dot)
        {
            query.findOne((builder) =>
            {
                builder
                    .orWhere({ 'sdGuid': id, 'dotNumber': dot })
                    .orWhere({ 'scId': id, 'dotNumber': dot });
            });
        }
    }

    /**
     * this is to send the object to external source
     */
    $formatJson(json)
    {
        json = super.$formatJson(json);
        json.rtype = json.rtype?.toLowerCase() ?? 'unknown';

        if (!Object.keys(FieldFilters.whitelist.endpoint.byType.outgoing).includes(json.rtype))
        {
            json.rtype = 'unknown';
        }

        const whitelist = FieldFilters.whitelist.endpoint.byType.outgoing[json.rtype];
        const copy = {};
        for (const field of whitelist)
        {
            copy[field] = json[field];
        }
        return copy;
    }

    linkRecordType(recType)
    {
        this.recordTypeId = recType.sfId;
    }

    linkPrimaryContact(contact)
    {
        this.primaryContactId = contact.sfId;
    }

    isEDIClient()
    {
        return this.ediClient === true;
    }

    static validateAccountForServiceJob(account)
    {
        const errors = [];

        if (!account)
            errors.push(new NotFoundError('Vendor does not exist'));
        if (account?.blackList)
            errors.push(new DataConflictError('Vendor is blacklisted.'));
        if (account?.rectype?.name?.toLowerCase() !== 'vendor')
            errors.push(new DataConflictError('Provided vendor is not a valid vendor. Please contact support'));

        return errors;
    }
}

module.exports = SFAccount;