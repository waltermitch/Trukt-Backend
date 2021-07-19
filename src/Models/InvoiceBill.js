const BaseModel = require('./BaseModel');

/**
 * This class represents an invoice or a bill
 */
class InvoiceBill extends BaseModel
{

    static get tableName()
    {
        return 'rcgTms.invoiceBills';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const SFAccount = require('./SFAccount');
        return {
            lines: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./InvoiceLine'),
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    to: 'rcgTms.invoiceBillLines.invoiceGuid'
                }
            },
            client: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.invoiceBills.externalPartyGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            vendor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.invoiceBills.externalPartyGuid',
                    to: 'salesforce.accounts.guid'
                }
            }
        };
    }
}

module.exports = InvoiceBill;