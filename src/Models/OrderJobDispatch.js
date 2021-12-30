const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const BaseModel = require('./BaseModel');
const { DateTime } = require('luxon');

class OrderJobDispatch extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobDispatches';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const SFContact = require('./SFContact');
        return {
            job: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.orderJobDispatches.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            vendor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./SFAccount'),
                join: {
                    from: 'rcgTms.orderJobDispatches.vendorGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            vendorContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobDispatches.vendorContactGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            vendorAgent: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobDispatches.vendorAgentGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            loadboardPost: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./LoadboardPost'),
                join: {
                    from: 'rcgTms.orderJobDispatches.loadboardPostGuid',
                    to: 'rcgTms.loadboardPosts.guid'
                }
            },
            paymentMethod: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./InvoicePaymentMethod'),
                join: {
                    from: 'rcgTms.orderJobDispatches.paymentMethodId',
                    to: 'rcgTms.invoiceBillPaymentMethods.id'
                }
            },
            paymentTerm: {
                relation: BaseModel.HasOneRelation,
                modelClass: require('./InvoicePaymentTerm'),
                join: {
                    from: 'rcgTms.orderJobDispatches.paymentTermId',
                    to: 'rcgTms.invoiceBillPaymentTerms.id'
                }
            }
        };
    }

    static get modifiers()
    {
        return {
            // returns a single active dispatch record
            activeDispatch(builder)
            {
                builder.where((builder) =>
                {
                    builder.where({ isPending: true, isCanceled: false, isValid: true }).orWhere({ isAccepted: true, isCanceled: false, isValid: true });
                }).limit(1);
            }
        };
    }

    // this is meant to be used to update the dispatch when a carrier declines an offer
    setToDeclined()
    {
        this.isPending = false;
        this.isAccepted = false;
        this.isCanceled = false;
        this.isDeclined = true;
        this.isValid = false;
        this.dateDeclined = DateTime.now();
    }

    // this is meant to be used to update the dispatch when a carrier or a dispatcher
    // accepts the offer
    setToAccepted()
    {
        this.isPending = false;
        this.isAccepted = true;
        this.isCanceled = false;
        this.isDeclined = false;
        this.isValid = true;
        this.dateAccepted = DateTime.now();
    }

    // this is meant to be used to update the dispatch when a dispatcher
    // cancels the offer/dispatch themselves
    setToCanceled(userGuid)
    {
        this.isPending = false;
        this.isAccepted = false;
        this.isCanceled = true;
        this.isDeclined = false;
        this.isValid = false;
        this.dateCanceled = DateTime.now();
        this.canceledByGuid = userGuid;
    }
}

Object.assign(OrderJobDispatch.prototype, RecordAuthorMixin);
module.exports = OrderJobDispatch;