const LoadboardRequest = require('../Models/LoadboardRequest');
const LoadboardPost = require('../Models/LoadboardPost');
const StatusManagerHandler = require('../EventManager/StatusManagerHandler');
const axios = require('axios');
const https = require('https');
const { ref } = require('objection');

const lbInstance = axios.create({
    baseURL: process.env['azure.loadboard.baseurl'],
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: { 'Content-Type': 'application/json' },
    params: { code: process.env['azure.loadboard.funcCode'] }
});

class LoadboardRequestService
{

    // query requests by thier guid
    static async getbyJobID(jobGuid)
    {
        // ask job for postings
        const qb = await LoadboardRequest.query().leftJoinRelated('posting').where('posting.jobGuid', jobGuid);

        // filter what I want to display
        return qb;
    }

    // webhook triggers this function
    static async createRequest(payload)
    {
        // query our database for requests from incoming payload
        const [lbRequest, lbPosting] = await Promise.all([
            LoadboardRequest
                .query()
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true })
                .where(ref('extraExternalData:guid').castText(), payload.extraExternalData.guid),
            LoadboardPost
                .query()
                .findOne('externalPostGuid', payload.extraExternalData.externalOrderID)
                .leftJoinRelated('job')
                .select('rcgTms.loadboardPosts.*', 'job.orderGuid')
        ]);

        console.log('Query Response of Request: ', lbRequest);
        console.log('LoadBoard Posting: ', lbPosting);

        if (lbPosting == undefined)
        {
            throw new Error('Posting Doesn\'t Exist');
        }

        // if requrest by carrier exist update it to inactive
        if (lbRequest)
        {
            await LoadboardRequest.query().findById(lbRequest.guid).patch({ isActive: false, isCanceled: true, status: 'Canceled' });

            // StatusManagerHandler.registerStatus({
            //     orderGuid: lbPosting.orderGuid,
            //     userGuid: payload.createdByGuid,
            //     jobGuid: lbPosting.jobGuid,
            //     statusId: 5
            // });
        }

        // updating payload for database
        Object.assign(payload, {
            loadboardPostGuid: lbPosting.guid,
            status: 'New',
            isSynced: true
        });

        // create row with that information
        const response = await LoadboardRequest.query().insert(payload);

        // update activities according to incoming request createBy
        StatusManagerHandler.registerStatus({
            orderGuid: lbPosting.orderGuid,
            userGuid: payload.createdByGuid,
            jobGuid: lbPosting.jobGuid,
            statusId: 4
        });

        return response;
    }

    // webhook triggers this function
    static async cancelRequests(payload)
    {
        // check to see if requests exists in table
        const [lbRequest, lbPosting] = await Promise.all([
            LoadboardRequest
                .query()
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true })
                .where(ref('extraExternalData:guid').castText(), payload.extraExternalData.guid),
            LoadboardPost
                .query()
                .findOne('externalPostGuid', payload.extraExternalData.externalOrderID)
                .leftJoinRelated('job')
                .select('rcgTms.loadboardPosts.*', 'job.orderGuid')
        ]);

        console.log('Cancel Request Query', lbRequest);

        // search data base by the (RCG) guid and update to canceled
        const response = await LoadboardRequest.query().findById(lbRequest.guid).patch({
            status: 'Canceled',
            isActive: false,
            isCanceled: true,
            isSynced: true,
            declineReason: 'Canceled by Carrier'
        });

        // update status of requests
        StatusManagerHandler.registerStatus({
            orderGuid: lbPosting.orderGuid,
            userGuid: payload.createdByGuid,
            jobGuid: lbPosting.jobGuid,
            statusId: 5
        });

        return response;
    }

    // functions trigged by the TMS user
    static async acceptRequest(requestGuid)
    {
        // finding request to update
        // const queryRequest = await LoadboardRequest.query().findById(requestGuid);
        // console.log('Request to Accept', queryRequest);

        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        console.log('Request Magic', queryRequest);

        // updating object for loadboard logic
        Object.assign(queryRequest, {
            status: 'Accepted',
            isAccepted: true,
            isDeclined: false,
            isCanceled: false
        });

        // send API request accept request
        const response = await lbInstance.post('/incomingLoadboardRequest', queryRequest);
        console.log('Response from LB', response);
        if (response.status == 200)
        {
            queryRequest.isSynced = true;
        }
        else
        {
            queryRequest.isSynced = false;
            queryRequest.hasError = true;
            queryRequest.externalError = response;
        }

        // search RCG data base by the guid and update to accepted
        await LoadboardRequest.query().findById(requestGuid).patch(queryRequest);

        // update  status of request and TODO: change user createdBY
        StatusManagerHandler.registerStatus({
            orderGuid: queryRequest.orderGuid,
            userGuid: queryRequest.createdByGuid,
            jobGuid: queryRequest.jobGuid,
            statusId: 6
        });

        return response;
    }

    // functions trigged by the TMS user
    static async declineRequest(requestGuid, payload)
    {
        // find request by guid
        // const queryRequest = await LoadboardRequest.query().findById(requestGuid);

        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        Object.assign(queryRequest, {
            status: 'Declined',
            isAccepted: false,
            isDeclined: true,
            isCanceled: false,
            declineReason: payload?.reason
        });

        // send API request decline request
        const response = await lbInstance.post('/incomingLoadboardRequest', queryRequest);
        if (response.status == 200)
        {
            queryRequest.isSynced = true;
        }
        else
        {
            queryRequest.isSynced = false;
            queryRequest.hasError = true;
            queryRequest.externalError = response;
        }

        // search data base by the guid that super provides and update to canceled
        await LoadboardRequest.query().findById(requestGuid).patch(queryRequest);

        StatusManagerHandler.registerStatus({
            orderGuid: queryRequest.orderGuid,
            userGuid: queryRequest.createdByGuid,
            jobGuid: queryRequest.jobGuid,
            statusId: 7
        });

        return response;
    }
}

module.exports = LoadboardRequestService;