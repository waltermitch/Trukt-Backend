const BaseModel = require('./BaseModel');

class OrderJobType extends BaseModel
{
    static get tableName()
    {
        return 'rcgTms.orderJobTypes';
    }

    static get idColumn()
    {
        return 'id';
    }

    /**
     *  Used to compare if the job has the current job type
     * @param {OrderJob} job
     * @param {OrderJobType} jobType
     * @returns {boolean}
     */
    static compare(job, jobType)
    {
        // do not want undefined values to match undefined values
        // one big line because of short circuit boolean evaluation
        return (jobType.id != undefined && jobType.id == job?.typeId) || (jobType?.type != undefined && jobType?.category != undefined && jobType.category === job.jobType.category && jobType.type === job.jobType.type);
    }

    static getJobTypesByCategories(jobCategories = [])
    {
        return this.query().select('id').whereIn('category', jobCategories);
    }
}

module.exports = OrderJobType;