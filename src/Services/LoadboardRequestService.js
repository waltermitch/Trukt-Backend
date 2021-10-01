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

        return qb;
    }

    // webhook triggers this function
    static async createRequest(payload, currentUser)
    {
        // query our database for requests from incoming payload
        const [lbRequest, lbPosting] = await Promise.all([
            LoadboardRequest
                .query()
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true })
                .where(ref('extraExternalData:carrierInfo.guid').castText(), payload.extraExternalData.carrierInfo.guid),
            LoadboardPost
                .query()
                .findOne('externalPostGuid', payload.extraExternalData.externalOrderID)
                .leftJoinRelated('job')
                .select('rcgTms.loadboardPosts.*', 'job.orderGuid')
        ]);
        console.log(lbRequest, lbPosting);
        if (lbPosting == undefined)
        {
            throw new Error('Posting Doesn\'t Exist');
        }

        // if requrest by carrier exist update it to inactive
        if (lbRequest)
        {
            await LoadboardRequest.query().findById(lbRequest.guid).patch({ isActive: false, isCanceled: true, status: 'Canceled' });

            await StatusManagerHandler.registerStatus({
                orderGuid: lbPosting.orderGuid,
                userGuid: payload.createdByGuid,
                jobGuid: lbPosting.jobGuid,
                statusId: 5,
                extraAnnotations: {
                    loadboard: payload.loadboard,
                    carrier: {
                        guid: payload.extraExternalData.guid,
                        name: payload.extraExternalData.name
                    }
                }
            });
        }

        // updating payload for database
        Object.assign(payload, {
            loadboardPostGuid: lbPosting.guid,
            createdByGuid: currentUser,
            status: 'New',
            isSynced: true
        });

        // create row with that information
        const response = await LoadboardRequest.query().insert(payload);

        // update activities according to incoming request createBy
        await StatusManagerHandler.registerStatus({
            orderGuid: lbPosting.orderGuid,
            userGuid: currentUser,
            jobGuid: lbPosting.jobGuid,
            statusId: 4,
            extraAnnotations: {
                loadboard: payload.loadboard,
                carrier: {
                    guid: payload.extraExternalData.guid,
                    name: payload.extraExternalData.name
                }
            }
        });

        return response;
    }

    // webhook triggers this function
    static async cancelRequests(payload, currentUser)
    {
        // check to see if requests exists in table
        const [lbRequest, lbPosting] = await Promise.all([
            LoadboardRequest
                .query()
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true })
                .where(ref('extraExternalData:carrierInfo.guid').castText(), payload.extraExternalData.carrierInfo.guid),
            LoadboardPost
                .query()
                .findOne('externalPostGuid', payload.extraExternalData.externalOrderID)
                .leftJoinRelated('job')
                .select('rcgTms.loadboardPosts.*', 'job.orderGuid')
        ]);

        // search data base by the (RCG) guid and update to canceled
        const response = await LoadboardRequest.query().findById(lbRequest.guid).patch({
            status: 'Canceled',
            isActive: false,
            isCanceled: true,
            isSynced: true,
            updatedByGuid: currentUser,
            declineReason: 'Canceled by Carrier'
        });

        // update status of requests in status manger
        await StatusManagerHandler.registerStatus({
            orderGuid: lbPosting.orderGuid,
            userGuid: currentUser,
            jobGuid: lbPosting.jobGuid,
            statusId: 5,
            extraAnnotations: {
                loadboard: payload.loadboard,
                carrier: {
                    guid: payload.extraExternalData.guid,
                    name: payload.extraExternalData.name
                }
            }
        });

        return response;
    }

    // functions trigged by the TMS user
    static async acceptRequest(requestGuid, currentUser)
    {
        // finding request to update and attach orderGUID and jobGUID
        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        // updating object for loadboard logic
        Object.assign(queryRequest, {
            status: 'Accepted',
            isAccepted: true,
            isDeclined: false,
            isCanceled: false,
            updatedByGuid: currentUser
        });

        // send API request accept request and updating payload accordingly
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

        // update  status of request and TODO: change user createdBY
        await StatusManagerHandler.registerStatus({
            orderGuid: queryRequest.orderGuid,
            userGuid: currentUser,
            jobGuid: queryRequest.jobGuid,
            statusId: 6,
            extraAnnotations: {
                loadboard: queryRequest.loadboard,
                carrier: {
                    guid: queryRequest.extraExternalData.guid,
                    name: queryRequest.extraExternalData.name
                }
            }
        });

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        // search RCG data base by the guid and update to accepted
        await LoadboardRequest.query().findById(requestGuid).patch(queryRequest);

        return queryRequest;
    }

    // functions trigged by the TMS user
    static async declineRequest(requestGuid, payload, currentUser)
    {
        // find request by guid
        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        // updating object with proper statuses
        Object.assign(queryRequest, {
            status: 'Declined',
            isAccepted: false,
            isDeclined: true,
            isCanceled: false,
            declineReason: payload?.reason,
            updatedByGuid: currentUser
        });

        // send API request decline request and updating payload accordingly
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

        // pushing status notifications
        await StatusManagerHandler.registerStatus({
            orderGuid: queryRequest.orderGuid,
            userGuid: currentUser,
            jobGuid: queryRequest.jobGuid,
            statusId: 7,
            extraAnnotations: {
                loadboard: queryRequest.loadboard,
                carrier: {
                    guid: queryRequest.extraExternalData.guid,
                    name: queryRequest.extraExternalData.name
                }
            }
        });

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        // search data base by the guid that super provides and update to canceled
        await LoadboardRequest.query().findById(requestGuid).patch(queryRequest);

        return queryRequest;
    }
}

module.exports = LoadboardRequestService;