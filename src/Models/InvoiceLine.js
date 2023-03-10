const { RecordAuthorMixin, isNotDeleted, AuthorRelationMappings } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');
const { DateTime } = require('luxon');

class InvoiceLine extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.invoiceBillLines';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const relations =
        {
            commodity: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.invoiceBillLines.commodityGuid',
                    to: 'rcgTms.commodities.guid'
                }
            },
            item: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceLineItem'),
                join: {
                    from: 'rcgTms.invoiceBillLines.itemId',
                    to: 'rcgTms.invoiceBillLineItems.id'
                }
            },
            invoiceBill: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.invoiceBillLines.invoiceGuid',
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            bill: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Bill'),
                join: {
                    from: 'rcgTms.invoiceBillLines.invoiceGuid',
                    to: 'rcgTms.bills.billGuid'
                }
            },
            invoice: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./Invoice'),
                join: {
                    from: 'rcgTms.invoiceBillLines.invoiceGuid',
                    to: 'rcgTms.invoices.invoiceGuid'
                }
            },
            link: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: InvoiceLine,
                join: {
                    from: 'rcgTms.invoiceBillLines.guid',
                    through: {
                        from: 'rcgTms.invoiceBillLineLinks.line2Guid',
                        to: 'rcgTms.invoiceBillLineLinks.line1Guid'
                    },
                    to: 'rcgTms.invoiceBillLines.guid'
                }
            },
            linkOne: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: InvoiceLine,
                join: {
                    from: 'rcgTms.invoiceBillLines.guid',
                    through: {
                        from: 'rcgTms.invoiceBillLineLinks.line1Guid',
                        to: 'rcgTms.invoiceBillLineLinks.line2Guid'
                    },
                    to: 'rcgTms.invoiceBillLines.guid'
                }
            },
            linkTwo: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: InvoiceLine,
                join: {
                    from: 'rcgTms.invoiceBillLines.guid',
                    through: {
                        from: 'rcgTms.invoiceBillLineLinks.line2Guid',
                        to: 'rcgTms.invoiceBillLineLinks.line1Guid'
                    },
                    to: 'rcgTms.invoiceBillLines.guid'
                }
            }
        };

        Object.assign(relations, AuthorRelationMappings(this.tableName));
        return relations;
    }

    static get modifiers()
    {
        const modifiers = {
            isSystemDefined(queryBuilder, value)
            {
                queryBuilder.where({ 'systemDefined': true, systemUsage: value });
            },
            transportOnly(builder)
            {
                builder.join('rcgTms.invoiceBillLineItems', 'rcgTms.InvoiceBillLines.itemId', 'rcgTms.invoiceBillLineItems.id').where(builder =>
                {
                    builder.where({ 'rcgTms.invoiceBillLineItems.name': 'transport', 'rcgTms.invoiceBillLineItems.type': 'revenue' });
                });
            },
            isValid(builder)
            {
                builder.where('isValid', true);
            },
            isNotPaid(builder)
            {
                builder.where('isPaid', false);
            },
            isNotTransport(builder)
            {
                builder.where(builder =>
                {
                    builder.whereNull('commodity_guid')
                        .orWhere('itemId', '<>', 1);
                });
            },
            isNonZero(builder)
            {
                builder.where('amount', '>', 0);
            }
        };
        Object.assign(modifiers, isNotDeleted(InvoiceLine.tableName));
        return modifiers;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        if (!(json?.item))
        {
            const item = {};
            for (const field of ['name', 'type', 'isAccessorial'])
            {
                if (field in json)
                {
                    item[field] = json[field];
                    delete json[field];
                }
            }

            if ('itemId' in json)
            {
                item.id = json.itemId;
            }

            if (Object.keys(item) > 0)
            {
                json.item = item;
            }
        }
        return json;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);
        if ('item' in json)
        {
            for (const field of ['name', 'isAccessorial'])
            {
                json[field] = json.item[field];
            }
            json.itemId = json.item.id;
            delete json.item;
        }

        if (json.commodity)
        {
            delete json.commodity.extraExternalData;
        }
        return json;
    }

    linkBill(bill)
    {
        const InvoiceBill = require('./InvoiceBill');
        const Bill = require('./Bill');

        if (bill instanceof Bill)
        {
            this.invoiceGuid = bill.billGuid;
        }
        else if (bill instanceof InvoiceBill)
        {
            this.invoiceGuid = bill.guid;
        }
    }

    linkInvoice(invoice)
    {
        const InvoiceBill = require('../Models/InvoiceBill');
        const Invoice = require('./Invoice');

        if (invoice instanceof Invoice)
        {
            this.invoiceGuid = invoice.invoiceGuid;
        }
        else if (invoice instanceof InvoiceBill)
        {
            this.invoiceGuid = invoice.guid;
        }
    }

    /**
     * Mark invoice/bill for this line as paid when all the lines are paid.
     * @param {string} currentUser
     * @param {import('objection').TransactionOrKnex} trx
     */
    async setAsPaidInvoiceBill(currentUser, trx)
    {
        const invoiceBill = await this.$relatedQuery('invoiceBill', trx);

        if (this.isPaid)
        {
            const lineQuery = InvoiceLine.query().select(1).where({
                invoiceGuid: invoiceBill.guid,
                isPaid: false
            }).whereNot('amount', 0);

            // this will set is_paid to true in bill/invoice if all lines with amount over 0 are paid
            await invoiceBill.$query(trx).patch({
                isPaid: true,
                datePaid: DateTime.now().toISO(),
                updatedByGuid: currentUser
            })
                .whereNotExists(lineQuery);
        }
    }
}

Object.assign(InvoiceLine.prototype, RecordAuthorMixin);
module.exports = InvoiceLine;