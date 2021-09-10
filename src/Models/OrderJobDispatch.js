const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');

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
            }
        };
    }

    static get modifiers()
    {
        return {
            // returns a single active dispatch record
            activeDispatch(builder)
            {
                builder.where({ isActive: true, isCanceled: false }).limit(1);
            }
        };
    }
}

Object.assign(OrderJobDispatch.prototype, RecordAuthorMixin);
module.exports = OrderJobDispatch;