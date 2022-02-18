const LoadboardRequest = require('../Models/LoadboardRequest');
const LoadboardPost = require('../Models/LoadboardPost');
const emitter = require('../EventListeners/index');
const SFAccount = require('../Models/SFAccount');
const { ref } = require('objection');
const axios = require('axios');
const https = require('https');
const ActivityManagerService = require('./ActivityManagerService');

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
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isValid': true })
                .where(ref('extraExternalData:carrierInfo.guid').castText(), payload.extraExternalData.carrierInfo.guid),
            LoadboardPost
                .query()
                .findOne('externalPostGuid', payload.extraExternalData.externalOrderID)
                .leftJoinRelated('job')
                .select('rcgTms.loadboardPosts.*', 'job.orderGuid')
        ]);

        if (lbPosting == undefined)
        {
            throw new Error('Posting Doesn\'t Exist');
        }

        // if requrest by carrier exist update it to invalid
        if (lbRequest)
        {
            await LoadboardRequest.query().findById(lbRequest.guid).patch({ isValid: false, isCanceled: true, status: 'Canceled' });

            await ActivityManagerService.createAvtivityLog({
                orderGuid: lbPosting.orderGuid,
                userGuid: payload.createdByGuid,
                jobGuid: lbPosting.jobGuid,
                activityId: 5,
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
        await ActivityManagerService.createAvtivityLog({
            orderGuid: lbPosting.orderGuid,
            userGuid: currentUser,
            jobGuid: lbPosting.jobGuid,
            activityId: 4,
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
                .findOne({ 'externalPostGuid': payload.externalPostGuid, 'isValid': true })
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
            isValid: false,
            isCanceled: true,
            isSynced: true,
            updatedByGuid: currentUser,
            declineReason: 'Canceled by Carrier'
        });

        // update status of requests in status manger
        await ActivityManagerService.createAvtivityLog({
            orderGuid: lbPosting.orderGuid,
            userGuid: currentUser,
            jobGuid: lbPosting.jobGuid,
            activityId: 5,
            extraAnnotations: {
                loadboard: payload.loadboard,
                carrier: {
                    guid: payload.extraExternalData.guid,
                    name: payload.extraExternalData.name
                }
            }
        });

        emitter.emit('orderjob_dispatch_canceled', { jobGuid: lbPosting.jobGuid, dispatcherGuid: currentUser, orderGuid: lbPosting.orderGuid });

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
            isValid: false,
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

        // payload to send dispatch job
        const acceptPayload = {
            loadboard: queryRequest.loadboard,
            carrier: {
                guid: null
            },
            driver: {
                guid: null
            },
            jobGuid: queryRequest.jobGuid,
            orderGuid: queryRequest.orderGuid,
            pickup: {
                dateType: 'exactly',
                startDate: queryRequest.datePickupStart,
                endDate: queryRequest.datePickupEnd
            },
            delivery: {
                dateType: 'exactly',
                startDate: queryRequest.dateDeliveryStart,
                endDate: queryRequest.dateDeliveryEnd
            },
            paymentTerm: 4,
            paymentMethod: 17,
            price: queryRequest.price
        };

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        // update the loadRequest to be accepted and set to invalid
        // get carrier information for disptaching job
        // update status manager with Load request accepted
        const [result, carrierInfo] = await Promise.all([
            LoadboardRequest.query().patchAndFetchById(requestGuid, queryRequest),
            SFAccount.query().modify('externalIdandDot', queryRequest.extraExternalData.carrierInfo.guid, queryRequest.carrierIdentifier),
            ActivityManagerService.createAvtivityLog({
                orderGuid: queryRequest.orderGuid,
                userGuid: currentUser,
                jobGuid: queryRequest.jobGuid,
                activityId: 6,
                extraAnnotations: {
                    loadboard: queryRequest.loadboard,
                    carrier: {
                        guid: queryRequest.extraExternalData.guid,
                        name: queryRequest.extraExternalData.name
                    }
                }
            })
        ]);

        // assign carrier sfid to payload
        acceptPayload.carrier.guid = carrierInfo.sfId;

        // hit event to update to pending and remove all postings
        emitter.emit('load_request_accepted', { jobGuid: acceptPayload.jobGuid, currentUser: currentUser, orderGuid: acceptPayload.orderGuid, body: acceptPayload });

        return result;
    }

    /**
     * Method declines single request of the payload.
     * @param {uuid} requestGuid
     * @param {uuid} reason
     * @param {uuid} currentUser
     * @returns
     */
    static async declineRequest(requestGuid, reason, currentUser)
    {
        // find request by guid
        const queryRequest = await LoadboardRequest
            .query()
            .findOne({ 'rcgTms.loadboardRequests.guid': requestGuid })
            .leftJoinRelated('posting.job')
            .select('rcgTms.loadboardRequests.*', 'posting.jobGuid', 'posting:job.orderGuid');

        // to pass it on to the event
        const jobGuid = queryRequest.jobGuid;
        const orderGuid = queryRequest.orderGuid;

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        queryRequest.setDeclined(reason);
        queryRequest.setUpdatedBy(currentUser);

        // send API request decline request and updating payload accordingly
        const response = await lbInstance.post('/incomingLoadboardRequest', LoadboardRequestService.toAcceptorDeclineJSON(queryRequest));

        if (response.status !== 200)
        {
            queryRequest.hasError = true;
            queryRequest.externalError = response?.data ?? 'Unable to get error.';
        }

        await queryRequest.$query().patchAndFetch();

        // pushing status notifications
        await ActivityManagerService.createAvtivityLog({
            orderGuid: orderGuid,
            userGuid: currentUser,
            jobGuid: jobGuid,
            activityId: 7,
            extraAnnotations: {
                loadboard: queryRequest.loadboard,
                carrier: {
                    guid: queryRequest.extraExternalData.guid,
                    name: queryRequest.extraExternalData.name
                }
            }
        });

        return;
    }





    static toAcceptorDeclineJSON(input)
    {
        return {
            requestGuid: input.externalPostGuid,
            externalOrderID: input.extraExternalData.externalOrderID,
            status: input.status,
            isAccepted: input.isAccepted,
            isDeclined: input.isDeclined
        };
    }
}

module.exports = LoadboardRequestService;