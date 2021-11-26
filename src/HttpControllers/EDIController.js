const { DateTime } = require('luxon');
const currency = require('currency.js');
const R = require('ramda');
const OrderService = require('../Services/OrderService');
const Order = require('../Models/Order');
const EDIData = require('../Models/EDIData');
const OrderJob = require('../Models/OrderJob');

const SCAC_CODE = 'RCGQ';

const reasons =
    [
        'price is not correct for load',
        'found better price for load',
        'cannot find truck',
        'dog ate the load',
        'too time sensitive load',
        'no price provided',
        'weather wont permit',
        'dispatcher didnt like the load',
        'unreasonable requests for load',
        'load is expired',
        'none'
    ];

/* eslint-disable */
const shipmentStatusCodes = [
    'A3', // Shipment Returned to Shipper
    'A7', // Refused by Consignee
    'A9', // Shipment Damaged
    'AF', // Carrier Departed Pick - up Location with Shipment
    'AG', // Estimated Delivery
    'AH', // Attempted Delivery
    'AI', // Shipment has been Reconsigned
    'AJ', // Tendered for Delivery
    'AM', // Loaded on Truck
    'AN', // Diverted to Air Carrier
    'AP', // Delivery Not Completed
    'AR', // Rail Arrival at Destination Intermodal Ramp
    'AV', // Available for Delivery
    'B6', // Estimated to Arrive at Carrier Terminal
    'BA', // Connecting Line or Cartage Pick - up
    'BC', // Storage in Transit
    'C1', // Estimated to Depart Terminal Location
    'CA', // Shipment Cancelled
    'CD', // Carrier Departed Delivery Location
    'CL', // Trailer Closed Out
    'CP', // Completed Loading at Pick - up Location
    'D1', // Completed Unloading at Delivery Location
    'I1', // In - Gate
    'J1', // Delivered to Connecting Line
    'K1', // Arrived at Customs
    'L1', // Loading
    'OA', // Out - Gate
    'OO', // Paperwork Received - Did not Receive Shipment or Equipment
    'P1', // Departed Terminal Location
    'PR', // U.S.Customs Hold at In - Bond Location
    'R1', // Received from Prior Carrier
    'RL', // Rail Departure from Origin Intermodal Ramp
    'S1', // Trailer Spotted at Consignee's Location
    'SD', // Shipment Delayed
    'X1', // Arrived at Delivery Location
    'X2', // Estimated Date and / or Time of Arrival at Consignee's Location
    'X3', // Arrived at Pick - up Location
    'X4', // Arrived at Terminal Location
    'X5', // Arrived at Delivery Location Loading Dock
    'X6', // En Route to Delivery Location
    'X8', // Arrived at Pick - up Location Loading Dock
    'XB' // Shipment Acknowledged
];
const shipmentStatusCodeReason =
    [
        'A1', //  Missed Delivery
        'A2', //  Incorrect Address
        'A3', //  Indirect Delivery
        'A5', //  Unable to Locate
        'A6', //  Address Corrected - Delivery Attempted
        'AA', //  Mis - sort
        'AD', //  Customer Requested Future Delivery
        'AE', //  Restricted Articles Unacceptable
        'AF', //  Accident
        'AG', //  Consignee Related
        'AH', //  Driver Related
        'AI', //  Mechanical Breakdown
        'AJ', //  Other Carrier Related
        'AK', //  Damaged, Rewrapped in Hub
        'AL', //  Previous Stop
        'AM', //  Shipper Related
        'AN', //  Holiday - Closed
        'AO', //  Weather or Natural Disaster Related
        'AP', //  Awaiting Export
        'AQ', //  Recipient Unavailable - Delivery Delayed
        'AR', //  Improper International Paperwork
        'AS', //  Hold Due to Customs Documentation Problems
        'AT', //  Unable to Contact Recipient for Broker Information
        'AU', //  Civil Event Related Delay
        'AV', //  Exceeds Service Limitations
        'AW', //  Past Cut - off Time
        'AX', //  Insufficient Pick - up Time
        'AY', //  Missed Pick - up
        'AZ', //  Alternate Carrier Delivered
        'B1', //  Consignee Closed
        'B2', //  Trap for Customer
        'B4', //  Held for Payment
        'B5', //  Held for Consignee
        'B8', //  Improper Unloading Facility or Equipment
        'B9', //  Receiving Time Restricted
        'BB', //  Held per Shipper
        'BC', //  Missing Documents
        'BD', //  Border Clearance
        'BE', //  Road Conditions
        'BF', //  Carrier Keying Error
        'BG', //  Other
        'BH', //  Insufficient Time to Complete Delivery
        'BI', //  Cartage Agent
        'BJ', //  Customer Wanted Earlier Delivery
        'BK', //  Prearranged Appointment
        'BL', //  Held for Protective Service
        'BM', //  Flatcar Shortage
        'BN', //  Failed to Release Billing
        'BO', //  Railroad Failed to Meet Schedule
        'BP', //  Load Shifted
        'BQ', //  Shipment Overweight
        'BR', //  Train Derailment
        'BS', //  Refused by Customer
        'BT', //  Returned to Shipper
        'C1', //  Waiting for Customer Pick - up
        'C2', //  Credit Hold
        'C3', //  Suspended at Customer Request
        'C4', //  Customer Vacation
        'C5', //  Customer Strike
        'C6', //  Waiting Shipping Instructions
        'C7', //  Waiting for Customer Specified Carrier
        'C8', //  Collect on Delivery Required
        'C9', //  Cash Not Available From Consignee
        'CA', //  Customs(Import or Export)
        'CB', //  No Requested Arrival Date Provided by Shipper
        'CC', //  No Requested Arrival Time Provided by Shipper
        'D1', //  Carrier Dispatch Error
        'D2', //  Driver Not Available
        'F1', //  Non - Express Clearance Delay
        'F2', //  International Non - carrier Delay
        'HB', //  Held Pending Appointment
        'NA', //  Normal Appointment
        'NS', //  Normal Status
        'P1', //  Processing Delay
        'P2', //  Waiting Inspection
        'P3', //  Production Falldown
        'P4', //  Held for Full Carrier Load
        'RC', //  Reconsigned
        'S1', //  Delivery Shortage
        'T1', //  Tractor With Sleeper Car Not Available
        'T2', //  Tractor, Conventional, Not Available
        'T3', //  Trailer not Available
        'T4', //  Trailer Not Usable Due to Prior Product
        'T5', //  Trailer Class Not Available
        'T6', //  Trailer Volume Not Available
        'T7' //  Insufficient Delivery Time
    ];
const shipmentAppointmentStatusCode =
    [
        'AA', //  Pick - up Appointment Date and / or Time
        'AB', //  Delivery Appointment Date and / or Time
        'AC', //  Estimated Delivery Appointment Date and / or Time
        'ED', //  Deliver No Earlier Than Date and / or Time
        'EP', //  Pick - up No Earlier Than Date and / or Time
        'LD', //  Deliver No Later Than Date and / or Time
        'LP', //  Pick - up No Later Than Date and / or Time
        'X9', //  Delivery Appointment Secured on This Date and / or Time
        'XA' //  Pick - up Appointment Secured on This Date and / or Time
    ];
/* eslint-enable */

const isUseful = R.compose(R.not, R.anyPass([R.isEmpty, R.isNil]));

class EDIController
{

    static async createTender(req, res, next)
    {
        try
        {
            const orderObj = req.body;
            orderObj.isTender = true;
            orderObj.isDummy = false;
            const ediData = orderObj.edi;

            // use total cost to split the amount across all of the commodities.
            // Not going to check the totalCost of the commodities vs the order total
            // because we can correct it in the application instead of when the order is entered into our system.
            if (isUseful(orderObj.totalCost))
            {
                // distribute the totalCost across all of the commodities
                const commCosts = currency(orderObj.totalcost).distribute(orderObj.commodities?.length);
                for (let i = 0; i < orderObj.commodities.length; i++)
                {
                    orderObj.commodities[i].cost = commCosts[i].value;
                }
            }
            else
            {
                // each commodity should have their own cost associated with it.
                // otherwise, set it to zero.
                const totalCost = currency(0);
                for (const commodity of orderObj.commodities)
                {
                    commodity.cost = isUseful(commodity.cost) ? currency(commodity.cost).toString() : '0.00';
                    totalCost.add(commodity.cost);
                }
                orderObj.totalcost = totalCost.toString();
            }

            orderObj.estimatedRevenue = orderObj.estimatedRevenue = orderObj.totalCost;

            if (!(orderObj.jobs))
            {
                orderObj.jobs = [];

                const job = OrderJob.fromJson({
                    typeId: 1,
                    status: 'new',
                    index: 'job_1',
                    commodities: orderObj.commodities.map((it) =>
                    {
                        const comm = {
                            index: it.index,
                            expense: it.cost,
                            revenue: it.cost
                        };
                        return comm;
                    }),
                    stops: orderObj.stops.map((it) =>
                    {
                        const stop = {
                            index: it.index,
                            commodities: it.commodities
                        };
                        return stop;
                    })
                });
            }

            // clean up the commodity fields
            for (const comm of orderObj.commodities || [])
            {
                delete comm.cost;
            }

            // clear up the order fields
            delete orderObj.totalCost;
            delete orderObj.edi;

            const order = await OrderService.create(req.body, req.session.userGuid);

            await EDIData.query().insert({
                documentNumber: 200,
                orderGuid: order.guid,
                data: ediData
            });

            res.status(201);
            res.send(order.guid);
        }
        catch (err)
        {
            next(err);
        }
    }

    static async loadTenderResponse(action, req, res, next)
    {
        try
        {
            const queryParams = ['partner', 'reference'];
            const missing = [];
            for (const param of queryParams)
            {
                if (!(req.query[param]))
                {
                    missing.push(param);
                }
            }

            if (missing.length > 0)
            {
                let message = 'this is for development only and generates psuedo responses on demand\n';
                for (const param of missing)
                {
                    message += `missing ${param} query parameter\n`;
                }

                res.status(400);
                res.send(message);
                return;
            }

            const order = await Order.query()
                .findOne('referenceNumber', req.query.reference)
                .whereIn('clientGuid', Order.relatedQuery('client').findOne(builder =>
                {
                    builder.orWhere('guid', req.query.partner);
                    builder.orWhere('sfId', req.query.partner);
                }).select('guid'))
                .where('isTender', true)
                .withGraphJoined('ediData(loadTender)');

            if (!order)
            {
                throw new Error('load tender with reference number: "' + req.query.reference + '" doesn\'t exist');
            }

            const payload = {
                'action': action,
                'order': {
                    guid: order.guid,
                    number: order.number
                },
                'reference': req.query.reference,
                'partner': req.query.partner,
                'date': DateTime.now().toISO(),
                'scac': SCAC_CODE,
                edi: order.ediData[0]?.data
            };

            if (action != 'accept')
            {
                const rs = [];
                rs.push(reasons[parseInt(Math.random() * reasons.length)]);
                if (Math.random() > 0.5)
                {
                    rs.push(reasons[parseInt(Math.random() * reasons.length)]);
                }
                payload.reason = rs.join('. ');
            }

            res.status(200);
            res.json(payload);
        }
        catch (error)
        {
            next(error);
        }
    }

    static async inbound214(req, res, next)
    {
        try
        {
            // TODO: this is temp, will add using validator schema
            const missing = [
                'partner',
                'reference',
                'datetime',
                'status',
                'location'

            ].filter(it => { return !(it in req.body); });

            if (missing.length > 0)
            {
                throw new Error('missing field(s): ' + missing.join(', '));
            }

            const payload = req.body;
            const queries = [];

            const modifiers = {};
            const graphJoin = {
                client: true,
                stops: {
                    terminal: true
                }
            };

            if (payload.commodity)
            {
                graphJoin.stops.commodities = { $modify: ['byId'] };
                modifiers.byId = query => query.where('identifier', payload.commodity);
            }

            const orderQuery = Order.query()
                .findOne('rcg_tms.orders.referenceNumber', payload.reference)
                .where('clientGuid', Order.relatedQuery('client').findOne(builder =>
                {
                    builder.orWhere('client.guid', payload.partner);
                    builder.orWhere('client.sfId', payload.partner);
                }).select('guid'))
                .withGraphJoined(graphJoin)
                .modifiers(modifiers);

            if (payload.order)
            {
                orderQuery.where('rcg_tms.orders.guid', payload.order);
            }
            queries.push(orderQuery);

            const [order] = await Promise.all(queries);

            if (!order)
            {
                throw Error('order with reference number "' + payload.reference + '" doesn\'t exist');
            }

            if (payload.status.type == 'appointment')
            {
                // set appointment of an order
                /* eslint-disable */
                switch (payload.status.code)
                {
                    case 'AA':
                        //  Pick - up Appointment Date and / or Time
                        break;
                    case 'AB':
                        //  Delivery Appointment Date and / or Time
                        break;
                    case 'AC':
                        //  Estimated Delivery Appointment Date and / or Time
                        break;
                    case 'ED':
                        //  Deliver No Earlier Than Date and / or Time
                        break;
                    case 'EP':
                        //  Pick - up No Earlier Than Date and / or Time
                        break;
                    case 'LD':
                        //  Deliver No Later Than Date and / or Time
                        break;
                    case 'LP':
                        //  Pick - up No Later Than Date and / or Time
                        break;
                    case 'X9':
                        //  Delivery Appointment Secured on This Date and / or Time
                        break;
                    case 'XA':
                        //  Pick - up Appointment Secured on This Date and / or Time
                        break;
                    default:
                        throw new Error('unknown appointment status code: ' + payload.status.code);
                }
                /* eslint-enable */
            }
            else if (payload.status.type == 'status')
            {
                switch (payload.status.code)
                {
                    case 'A3':
                        // Shipment Returned to Shipper
                        break;
                    case 'A7':
                        // Refused by Consignee
                        break;
                    case 'A9':
                        // Shipment Damaged
                        break;
                    case 'AF':
                        // Carrier Departed Pick - up Location with Shipment
                        break;
                    case 'AG':
                        // Estimated Delivery
                        break;
                    case 'AH':
                        // Attempted Delivery
                        break;
                    case 'AI':
                        // Shipment has been Reconsigned
                        break;
                    case 'AJ':
                        // Tendered for Delivery
                        break;
                    case 'AM':
                        // Loaded on Truck
                        break;
                    case 'AN':
                        // Diverted to Air Carrier
                        break;
                    case 'AP':
                        // Delivery Not Completed
                        break;
                    case 'AR':
                        // Rail Arrival at Destination Intermodal Ramp
                        break;
                    case 'AV':
                        // Available for Delivery
                        break;
                    case 'B6':
                        // Estimated to Arrive at Carrier Terminal
                        break;
                    case 'BA':
                        // Connecting Line or Cartage Pick - up
                        break;
                    case 'BC':
                        // Storage in Transit
                        break;
                    case 'C1':
                        // Estimated to Depart Terminal Location
                        break;
                    case 'CA':
                        // Shipment Cancelled
                        break;
                    case 'CD':
                        // Carrier Departed Delivery Location
                        break;
                    case 'CL':
                        // Trailer Closed Out
                        break;
                    case 'CP':
                        // Completed Loading at Pick - up Location
                        break;
                    case 'D1':
                        // Completed Unloading at Delivery Location
                        break;
                    case 'I1':
                        // In - Gate
                        break;
                    case 'J1':
                        // Delivered to Connecting Line
                        break;
                    case 'K1':
                        // Arrived at Customs
                        break;
                    case 'L1':
                        // Loading
                        break;
                    case 'OA':
                        // Out - Gate
                        break;
                    case 'OO':
                        // Paperwork Received - Did not Receive Shipment or Equipment
                        break;
                    case 'P1':
                        // Departed Terminal Location
                        break;
                    case 'PR':
                        // U.S.Customs Hold at In - Bond Location
                        break;
                    case 'R1':
                        // Received from Prior Carrier
                        break;
                    case 'RL':
                        // Rail Departure from Origin Intermodal Ramp
                        break;
                    case 'S1':
                        // Trailer Spotted at Consignee's Location
                        break;
                    case 'SD':
                        // Shipment Delayed
                        break;
                    case 'X1':
                        // Arrived at Delivery Location
                        break;
                    case 'X2':
                        // Estimated Date and / or Time of Arrival at Consignee's Location
                        break;
                    case 'X3':
                        // Arrived at Pick - up Location
                        break;
                    case 'X4':
                        // Arrived at Terminal Location
                        break;
                    case 'X5':
                        // Arrived at Delivery Location Loading Dock
                        break;
                    case 'X6':
                        // En Route to Delivery Location
                        break;
                    case 'X8':
                        // Arrived at Pick - up Location Loading Dock
                        break;
                    case 'XB':
                        // Shipment Acknowledged
                        break;
                    default:
                        throw new Error('unknown status code: ' + payload.status.code);
                }
            }
            else
            {
                throw new Error('unknown status type: ' + payload.status.type);
            }

            res.status(200);
            res.json();
        }
        catch (err)
        {
            next(err);
        }
    }

    static async outbound214(req, res, next)
    {
        try
        {
            const orderQuery = Order.query().where('isTender', true).withGraphJoined('[ ediData(loadTender), client, stops.[ commodities, terminal] ]').limit(100);
            if (req.query.reference)
            {
                orderQuery.findOne('referenceNumber', req.query.reference);
            }
            let order = await orderQuery;
            if (Array.isArray(order) && order.length > 0)
            {
                order = order[Math.floor(Math.random() * order.length)];

            }
            else if (!order)
            {
                if (req.query.reference)
                {
                    throw new Error('load tender with reference number: "' + req.query.reference + '" doesn\'t exist');
                }
                else
                {
                    throw new Error('No order / load tender was found. Please create a load tender first.');
                }
            }
            const stop = order.stops[Math.floor(Math.random() * order.stops.length)];
            const commodity = stop?.commodities[Math.floor(Math.random() * stop.commodities.length)];
            const payload = {
                order: { guid: order.guid, number: order.number },
                partner: order.client.sfId,
                reference: order.referenceNumber,
                datetime: DateTime.now().toISO(),
                sla: order.client.sla || order.client.slaDays ? `${order.client.slaDays} days` : '10 days',
                edi: order.ediData[0]?.data
            };

            if (stop)
            {
                payload.commodity = commodity?.identifier;
                payload.location = {
                    sequence: stop.sequence,
                    name: stop.terminal.name,
                    city: stop?.terminal?.city,
                    state: stop?.terminal?.state,
                    country: stop?.terminal?.country,
                    latitude: stop?.terminal?.latitude,
                    longitude: stop?.terminal?.longitude
                };
            }

            if (Math.random() > 0.5)
            {
                payload.status = {
                    type: 'appointment',
                    code: shipmentAppointmentStatusCode[Math.floor(Math.random() * shipmentAppointmentStatusCode.length)],
                    reason: shipmentStatusCodeReason[Math.floor(Math.random() * shipmentStatusCodeReason.length)]
                };
            }
            else
            {
                payload.status = {
                    type: 'status',
                    code: shipmentStatusCodes[Math.floor(Math.random() * shipmentStatusCodes.length)],
                    reason: shipmentStatusCodeReason[Math.floor(Math.random() * shipmentStatusCodeReason.length)]
                };
            }

            res.status(200);
            res.json(payload);
        }
        catch (error)
        {
            next(error);
        }
    }
}

const controller = new EDIController();
module.exports = controller;