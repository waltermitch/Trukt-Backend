const BaseModel = require('./BaseModel');
const { RecordAuthorMixin } = require('./Mixins/RecordAuthors');
const IncomeCalcs = require('./Mixins/IncomeCalcs');

const jobTypeFields = ['category', 'type'];

class OrderJob extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobs';
    }

    static get idColumn()
    {
        return 'guid';
    }

    static get relationMappings()
    {
        const OrderStopLink = require('./OrderStopLink');
        const Order = require('./Order');
        const SFAccount = require('./SFAccount');
        const SFContact = require('./SFContact');
        return {
            vendor: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orderJobs.vendorGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            vendorContact: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorContactGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            order: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: Order,
                join: {
                    from: 'rcgTms.orderJobs.orderGuid',
                    to: 'rcgTms.orders.guid'
                }
            },
            stopLinks: {
                relation: BaseModel.HasManyRelation,
                modelClass: OrderStopLink,
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.orderStopLinks.jobGuid'
                }
            },
            stops: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./OrderStop'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: OrderStopLink,
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.stopGuid'
                    },
                    to: 'rcgTms.orderStops.guid'
                }
            },
            commodities: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./Commodity'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        modelClass: OrderStopLink,
                        from: 'rcgTms.orderStopLinks.jobGuid',
                        to: 'rcgTms.orderStopLinks.commodityGuid',
                        extra: ['lotNumber', 'stopGuid']
                    },
                    to: 'rcgTms.commodities.guid'
                }
            },
            loadboardPosts: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./LoadboardPost'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.loadboardPosts.jobGuid'
                }
            },
            jobType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./OrderJobType'),
                join: {
                    from: 'rcgTms.orderJobs.typeId',
                    to: 'rcgTms.orderJobTypes.id'
                }
            },
            vendorAgent: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorAgentGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            driver: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFContact,
                join: {
                    from: 'rcgTms.orderJobs.vendorAgentGuid',
                    to: 'salesforce.contacts.guid'
                }
            },
            dispatcher: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: SFAccount,
                join: {
                    from: 'rcgTms.orderJobs.dispatcherGuid',
                    to: 'salesforce.accounts.guid'
                }
            },
            equipmentType: {
                relation: BaseModel.BelongsToOneRelation,
                modelClass: require('./EquipmentType'),
                join: {
                    from: 'rcgTms.orderJobs.equipmentTypeId',
                    to: 'rcgTms.equipmentTypes.id'
                }
            },
            bills: {
                relation: BaseModel.ManyToManyRelation,
                modelClass: require('./InvoiceBill'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    through: {
                        from: 'rcgTms.bills.jobGuid',
                        to: 'rcgTms.bills.billGuid'
                    },
                    to: 'rcgTms.invoiceBills.guid'
                }
            },
            dispatches: {
                relation: BaseModel.HasManyRelation,
                modelClass: require('./OrderJobDispatch'),
                join: {
                    from: 'rcgTms.orderJobs.guid',
                    to: 'rcgTms.orderJobDispatches.jobGuid'
                }
            }
        };
    }

    $parseDatabaseJson(json)
    {
        json = super.$parseDatabaseJson(json);
        this.calculateGrossProfit(json.actualRevenue, json.actualExpense);
        return json;
    }

    $parseJson(json)
    {
        json = super.$parseJson(json);

        // inflate the jobType
        // TODO: create flatten method on BaseModel class
        if (!(json?.jobType))
        {
            const jobType = jobTypeFields.reduce((jobType, field) =>
            {
                if (field in json)
                {
                    jobType[field] = json[field];
                    delete json[field];
                }

                return jobType;
            }, {});

            if (json.typeId)
            {
                jobType.id = json.typeId;
            }

            if (Object.keys(jobType).length > 0)
            {
                json.jobType = jobType;
            }
        }

        json = this.mapIndex(json);
        return json;
    }

    $formatJson(json)
    {
        json = super.$formatJson(json);

        if (json?.jobType)
        {
            delete json.jobType.id;
            Object.assign(json, json.jobType);
            delete json.jobType;
            delete json.typeId;
        }

        return json;
    }

    setIndex(index)
    {
        const newIndex = 'job_' + Date.now() + index;
        super.setIndex(newIndex);
    }

    async $beforeInsert(context)
    {
        await super.$beforeInsert(context);
        this.calculateEstimatedIncome();
    }

    async $beforeUpdate(opt, context)
    {
        await super.$beforeUpdate(opt, context);
        this.calculateEstimatedIncome();
    }

    /**
     * @param {OrderJobType} type
     */
    setIsTransport(type)
    {
        this.isTransport = (type.category === 'transport');
    }
}

Object.assign(OrderJob.prototype, IncomeCalcs);
Object.assign(OrderJob.prototype, RecordAuthorMixin);
module.exports = OrderJob;