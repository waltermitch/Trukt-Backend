const LoadboardRequest = require('../Models/LoadboardRequest');
const LoadboardPost = require('../Models/LoadboardPost');
const Super = require('../Loadboards/SuperDispatch');
const SHIPCARS = require('../Loadboards/ShipCar');
const PubSub = require('../Azure/PubSub');

class LoadboardRequestService
{

    // query requests by thier guid
    static async getbyJobID(jobGuid)
    {
        // ask job for postings
        const qb = await LoadboardRequest.query().withGraphJoined('posting.job(byID)').modifiers({ byID: builder => builder.findById(jobGuid) });

        // filter what I want to display
        return qb;
    }

    // webhook triggers this function
    static async createRequest(payload)
    {
        // query for the order see if exists
        let response;
        try
        {
            // query our database for requests from incoming payload
            const queryResponse = await LoadboardRequest.query().where({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true, 'carrierIdentifier': payload.carrierIdentifier });

            // no such order request exist create new request
            if (queryResponse.length == 0)
            {
                // query for RCG loadboard posts where their order ID is our postGUID
                const loadboardPost = await LoadboardPost.query().where('externalPostGuid', payload.extraExternalData.externalOrderID);
                Object.assign(payload, {
                    loadboardPostGuid: loadboardPost.guid,
                    status: 'New',
                    isSynced: true
                });

                // create row with that information
                response = await LoadboardRequest.query().insert(payload);

                // pubsub
                await PubSub.publishToGroup(loadboardPost.jobGuid, { 'object': 'request', 'data': response });
            }

            if (queryResponse.length != 0)
            {
                const loadboardPost = await LoadboardPost.query().where('externalPostGuid', payload.extraExternalData.externalOrderID);

                // if request exist in our loadboard Posts then update to inactive
                // compare the loadboard post GUID vs incoming request post GUID
                // if (loadboardPost.externalPostGuid == queryResponse[0].extraExternalData.externalOrderID)
                if (loadboardPost)
                {
                    // use internal (RCG) GUID to update current post to inactive (use GUID of RCG)
                    const res = await LoadboardRequest.query().findById(queryResponse[0].guid).patch({ isActive: false });
                    console.log(res);

                    // creating a new payload
                    Object.assign(payload, {
                        loadboardPostGuid: loadboardPost.guid,
                        status: 'New',
                        isSynced: true
                    });

                    // create table with new request information
                    response = await LoadboardRequest.query().insert(payload);

                    // pubsub groupName: jobGUID , { object: "Request", data: "" } pubSUB
                    await PubSub.publishToGroup(loadboardPost.jobGuid, { 'object': 'request', 'data': response });
                }
            }
        }
        catch (error)
        {
            console.log(error);
        }
        return response;
    }

    // webhook triggers this function
    static async cancelRequests(payload)
    {
        // query for the order see if exists
        let response;
        try
        {
            // check to see if requests exists in table
            const queryResponse = await LoadboardRequest.query().where({ 'externalPostGuid': payload.externalPostGuid, 'isActive': true, 'carrierIdentifier': payload.carrierIdentifier });
            console.log(queryResponse);

            // if active request exists cancel it
            if (queryResponse.length == 0)
            {
                return;
            }
            else if (queryResponse.length > 0)
            {
                // search data base by the (RCG) guid and update to canceled
                response = LoadboardRequest.query().findById(queryResponse[0].guid).patch({
                    status: 'Canceled',
                    isActive: false,
                    isCanceled: true,
                    isSynced: true,
                    declineReason: 'Canceled by Carrier'
                });
            }
        }
        catch (error)
        {
            console.log(error);
        }
        return response;
    }

    // functions trigged by the TMS user
    static async acceptRequest(requestGuid)
    {
        let synced = false;
        let res;

        const queryRequest = await LoadboardRequest.query().findById(requestGuid);

        // if loadboard is SUPER
        if (queryRequest.loadboard == 'SUPERDISPATCH')
        {
            // send API request SUPER to cancel request
            const response = await Super.acceptLoadRequest(queryRequest.extraExternalData.externalOrderID, queryRequest.externalPostGuid);
            if (response.status == 'success')
            {
                synced = true;
            }

            // search RCG data base by the guid and update to accepted
            res = LoadboardRequest.query().findById(requestGuid).patch({
                status: 'Accpeted',
                isAccepted: true,
                isDeclined: false,
                isCanceled: false,
                isSynced: synced
            });

        }
        else if (queryRequest.loadboard == 'SHIPCARS')
        {
            // update SHIPCARS api
            const response = SHIPCARS.acceptLoadRequest(queryRequest.externalPostGuid, { offer: queryRequest.extraExternalData.offerUrl });

            if (response.status == 200)
            {
                synced = true;
            }

            // search data base by the guid that super provides and update to canceled
            res = LoadboardRequest.query().findById(requestGuid).patch({
                status: 'Accpeted',
                isAccepted: true,
                isDeclined: false,
                isCanceled: false,
                isSynced: synced
            });
        }

        return res;
    }

    // functions trigged by the TMS user
    static async declineRequest(requestGuid, payload)
    {
        let synced = false;
        let res;

        // find request by guid
        const queryRequest = LoadboardRequest.query().findById(requestGuid);

        // if loadboard is SHIPCARS
        if (queryRequest.loadboard == 'SUPERDISPATCH')
        {
            // send API request SUPER to decline request
            const response = await Super.declineLoadRequest(queryRequest.loadboardPostGuid, queryRequest.externalPostGuid, payload?.reason);
            if (response.status == 'success')
            {
                synced = true;
            }

            // search data base by the guid that super provides and update to canceled
            res = LoadboardRequest.query().findById(requestGuid).patch({
                status: 'Declined',
                isCanceled: false,
                isAccepted: false,
                isDeclined: true,
                isSynced: synced,
                declineReason: payload?.reason
            });
        }
        else if (queryRequest.loadboard == 'SHIPCARS')
        {
            // update SHIPCARS api
            const response = SHIPCARS.declineLoadRequest(queryRequest.externalPostGuid);
            if (response.status == 'success')
            {
                synced = true;
            }

            // search data base by the (RCG) guid and update to declined
            res = LoadboardRequest.query().findById(requestGuid).patch({
                status: 'Declined',
                isCanceled: false,
                isAccepted: false,
                isDeclined: true,
                isSynced: synced,
                extraExternalData: payload?.reason
            });
        }
        return res;
    }
}

module.exports = LoadboardRequestService;