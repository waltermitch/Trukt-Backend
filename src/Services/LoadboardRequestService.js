const LoadboardRequest = require('../Models/LoadboardRequest');
const LoadboardPost = require('../Models/LoadboardPost');
const emitter = require('../EventListeners/index');
const SFAccount = require('../Models/SFAccount');
const axios = require('axios');
const https = require('https');
const ActivityManagerService = require('./ActivityManagerService');
const PubSubService = require('./PubSubService');
const telemetry = require('../ErrorHandling/Insights');
const { SeverityLevel } = require('applicationinsights/out/Declarations/Contracts');

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

    /**
     * Method is used to create request in our system from incoming webhooks.
     * @param {Model} requestModel
     * @param {Object} externalPost
     * @param {Object} carrier
     * @param {string} currentUser
     * @returns newly created request in out system.
     */
    static async createRequestfromWebhook(requestModel, externalPost, carrier, currentUser)
    {
        // query our database for requests from incoming payload
        const lbPosting = await LoadboardPost.query().withGraphJoined('[job, requests(CarrierSpecific)]')
            .modifiers({
                CarrierSpecific: (request) =>
                {
                    request.where({
                        isValid: true,
                        carrierIdentifier: carrier.usDot
                    });
                }
            })
            .findOne({
                'rcgTms.loadboardPosts.externalGuid': externalPost.guid
            });

        if (!lbPosting)
        {
            throw new Error(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);

            // TODO: update this with proper ErrorHandlers.
            // throw NotFoundError(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);
        }

        const job = lbPosting.job;

        const existingRequests = lbPosting.requests;

        // if requrest by carrier exist update it to invalid
        if (existingRequests.length > 0)
        {
            const updates = existingRequests.map(req => { req.setCanceled(); req.setUpdatedBy(currentUser); return req.$query().patch(); });
            const results = await Promise.allSettled(updates);
            const activities = [];
            for (const res of results)
            {
                if (res.status == 'rejected')
                {
                    telemetry.trackException({
                        exception: res.reason,
                        properties:
                        {
                            orderGuid: job.orderGuid,
                            jobGuid: job.guid,
                            requestExternalGuid: requestModel.externalPostGuid,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        },
                        severity: SeverityLevel.Error
                    });
                }
                else
                {
                    activities.push(
                        ActivityManagerService.createAvtivityLog({
                            orderGuid: job.orderGuid,
                            userGuid: currentUser,
                            jobGuid: job.guid,
                            activityId: 5,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        })
                    );
                }
            }
            await Promise.all(activities);
        }

        requestModel.posting = { '#dbRef': lbPosting.guid };
        requestModel.setNew();
        requestModel.setCreatedBy(currentUser);

        const response = await requestModel.$query().insertGraph();

        // update activities according to incoming request createBy
        await ActivityManagerService.createAvtivityLog({
            orderGuid: job.orderGuid,
            userGuid: currentUser,
            jobGuid: job.guid,
            activityId: 4,
            extraAnnotations: {
                loadboard: lbPosting.loadboard,
                carrier: {
                    guid: carrier.guid,
                    name: carrier.name
                }
            }
        });

        // push to pushsub
        PubSubService.publishJobRequests(job.guid, response);

        return response;
    }

    /**
     * Method is used to cancel request in our system from incoming webhooks.
     * @param {Model} requestModel
     * @param {Object} externalPost
     * @param {Object} carrier
     * @param {string} currentUser
     * @returns
     */
    static async cancelRequestfromWebhook(requestModel, externalPost, carrier, currentUser)
    {
        // query our database for requests from incoming payload
        const lbPosting = await LoadboardPost.query().withGraphJoined('[job, requests(CarrierSpecific)]')
            .modifiers({
                CarrierSpecific: (request) =>
                {
                    request.where({
                        isValid: true,
                        carrierIdentifier: carrier.usDot
                    });
                }
            })
            .findOne({
                'rcgTms.loadboardPosts.externalGuid': externalPost.guid
            });

        if (!lbPosting)
        {
            throw new Error(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);

            // TODO: update this with proper ErrorHandlers.
            // throw NotFoundError(`The posting for ${externalPost.guid} doesn't exist for carrier ${carrier.usDot}`);
        }

        const job = lbPosting.job;

        const existingRequests = lbPosting.requests;

        if (existingRequests.length === 0)
        {
            throw new Error(`The request doesn't exist for carrier ${carrier.name}`);

            // TODO: update this with proper ErrorHandlers.
            // throw NotFoundError(`The request doesn't exist for carrier ${carrier.usDot}`);
        }

        const promiseArray = await existingRequests.map(request =>
        {
            request.setCanceled();
            request.setUpdatedBy(currentUser);
            return request.$query().updateAndFetch()
                .then(async result =>
                {
                    await Promise.all([
                        ActivityManagerService.createAvtivityLog({
                            orderGuid: job.orderGuid,
                            userGuid: currentUser,
                            jobGuid: job.guid,
                            activityId: 5,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        }),
                        PubSubService.publishJobRequests(job.guid, result)
                    ]);
                    return result;
                }).catch(error =>
                {
                    telemetry.trackException({
                        exception: error,
                        properties:
                        {
                            orderGuid: job.orderGuid,
                            jobGuid: job.guid,
                            requestExternalGuid: requestModel.externalPostGuid,
                            extraAnnotations: {
                                loadboard: lbPosting.loadboard,
                                carrier: {
                                    guid: carrier.guid,
                                    name: carrier.name
                                }
                            }
                        }
                    });
                    console.log(error);
                });
        });
        const response = await Promise.all(promiseArray);
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
            isValid: false,
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
        await ActivityManagerService.createAvtivityLog({
            orderGuid: queryRequest.orderGuid,
            userGuid: currentUser,
            jobGuid: queryRequest.jobGuid,
            activityId: 7,
            extraAnnotations: {
                loadboard: queryRequest.loadboard,
                carrier: {
                    guid: queryRequest.extraExternalData.guid,
                    name: queryRequest.extraExternalData.name
                }
            }
        });

        // to pass it on to the event
        const jobGuid = queryRequest.jobGuid;
        const orderGuid = queryRequest.orderGuid;

        // remove fields that do not exist to update table correctly
        delete queryRequest.jobGuid;
        delete queryRequest.orderGuid;

        // search data base by the guid that super provides and update to canceled
        await LoadboardRequest.query().findById(requestGuid).patch(queryRequest);

        emitter.emit('load_request_declined', { jobGuid: jobGuid, dispatcherGuid: currentUser, orderGuid: orderGuid });

        return;
    }
}

module.exports = LoadboardRequestService;