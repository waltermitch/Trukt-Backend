const BaseModel = require('./BaseModel');

class Bill extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.bills';
    }

    static get idColumn()
    {
        return ['billGuid', 'jobGuid', 'relationTypeId'];
    }

    static get relationMappings()
    {
        return {
            job:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJob'),
                join: {
                    from: 'rcgTms.bills.jobGuid',
                    to: 'rcgTms.orderJobs.guid'
                }
            },
            invoiceBill:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.bills.billGuid',
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            relation:
            {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./InvoiceBillRelationType'),
                join: {
                    from: 'rcgTms.bills.relationTypeId',
                    to: 'rcgTms.invoiceBillRelationTypes.id'
                }
            }
        };
    }
}

module.exports = Bill;