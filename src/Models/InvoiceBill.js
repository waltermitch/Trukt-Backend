const { RecordAuthorMixin, isNotDeleted } = require('./Mixins/RecordAuthors');
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
        const Order = require('./Order');
        const OrderJob = require('./OrderJob');
        return {
            lines: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./InvoiceLine'),
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    to: 'rcgTms.invoiceBillLines.invoiceGuid'
                }
            },
            consignee: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.invoiceBills.consigneeGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            order: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    through: {
                        from: 'rcgTms.invoices.invoiceGuid',
                        to: 'rcgTms.invoices.orderGuid'
                    },
                    to: 'rcgTms.orders.guid'
                }
            },
            job: {
                relation: BaseModel.HasOneThroughRelation,
                modelClass: OrderJob,
                join: {
                    from: 'rcgTms.invoiceBills.guid',
                    through: {
                        from: 'rcgTms.bills.billGuid',
                        to: 'rcgTms.bills.jobGuid'
                    },
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            paymentTerms: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoicePaymentTerm'),
                join: {
                    from: 'rcgTms.invoiceBills.paymentTermId',
                    to: 'rcgTms.invoiceBillPaymentTerms.id'
                }
            },
            paymentMethod: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoicePaymentMethod'),
                join: {
                    from: 'rcgTms.invoiceBills.paymentMethodId',
                    to: 'rcgTms.invoiceBillPaymentMethods.id'
                }
            }
        };
    }

    static get fetch()
    {
        return {
            'details': {
                $modify: ['isNotDeleted'],
                paymentTerms: true,
                paymentMethod: true,
                consignee: true,
                lines: {
                    $modify: ['isNotDeleted'],
                    createdBy: true,
                    commodity: {
                        commType: true,
                        vehicle: true
                    },
                    item: true
                }
            }
        };
    }

    static get modifiers()
    {
        const modifiers = {
            bill(builder)
            {
                builder.where('isInvoice', false);
            },
            invoice(builder)
            {
                builder.where('isInvoice', true);
            },
            transportOnly(builder)
            {
                const InvoiceLine = require('./InvoiceLine');
                builder.alias('inv').whereExists(
                    InvoiceLine.query()
                    .where('itemId', 1)
                    .whereRaw('invoice_guid = inv.guid')
                );
            }
        };

        Object.assign(modifiers, isNotDeleted(InvoiceBill.tableName));

        return modifiers;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);

        if (json.consignee)
        {
            const consignee = json.consignee;
            for (const field of [
                'blacklist',
                'dotNumber',
                'loadboardInstructions',
                'mcNumber',
                'orderInstructions',
                'preferred',
                'qbId',
                'scId',
                'sdGuid',
                'sfId',
                'status',
                'syncInSuper'
            ])
            {
                delete consignee[field];
            }
        }

        for (const field of ['paymentMethodId', 'paymentTermId'])
        {
            delete json[field];
        }

        if (json?.paymentTerms)
        {
            json.paymentTerms = json.paymentTerms.name;
        }

        if (json?.paymentMethod)
        {
            json.paymentMethod = json.paymentMethod.name;
        }

        return json;
    }
}

Object.assign(InvoiceBill.prototype, RecordAuthorMixin);
module.exports = InvoiceBill;