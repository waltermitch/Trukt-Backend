const { DateTime } = require('luxon');
const faker = require('faker');

const EDI_DATE_FORMAT = 'yyyyLLdd';
const EDI_TIME_FORMAT = 'HHmmss';
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
        'godzilla is attacking roads',
        'dispatcher didnt like the load',
        'unreasonable requests for load',
        'load is expired',
        'none'
    ];

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

class EDIController
{
    static async reject(req, res)
    {
        if (!(req.query.partner))
        {
            res.status(400);
            res.send('missing partner query parameter');
            return;
        }
        if (!(req.query.bol))
        {
            res.status(400);
            res.send('missing bol query parameter');
            return;
        }

        const partner = req.query.partner;
        const bol = req.query.bol;
        const ediDate = DateTime.now().toFormat(EDI_DATE_FORMAT);
        const rs = [];
        rs.push(reasons[parseInt(Math.random() * reasons.length)]);
        if (Math.random() > 0.5)
        {
            rs.push(reasons[parseInt(Math.random() * reasons.length)]);
        }

        res.status(200);
        res.json({
            'actionCode': 'D',
            'reason': rs,
            'partner': partner,
            'scac': SCAC_CODE,
            'bol': bol,
            'date': ediDate
        });
    }

    static async accept(req, res)
    {

        if (!(req.query.partner))
        {
            res.status(400);
            res.send('missing partner query parameter');
            return;
        }
        if (!(req.query.bol))
        {
            res.status(400);
            res.send('missing bol query parameter');
            return;
        }

        const partner = req.query.partner;
        const bol = req.query.bol;
        const ediDate = DateTime.now().toFormat(EDI_DATE_FORMAT);

        res.status(200);
        res.json({
            'actionCode': 'A',
            'partner': partner,
            'scac': SCAC_CODE,
            'bol': bol,
            'date': ediDate
        });
    }

    static async inbound214(req, res)
    {
        if (!(req.query.partner))
        {
            res.status(400);
            res.send('missing partner in query parameter');
            return;
        }

        let payload;
        switch (req.query.partner)
        {
            case '7147617300':
                // this is yamaha partner id
                payload = await EDIController.inbound214yamaha(req);
                break;
            case 'AGTX':
                // this is the agistix
                payload = await EDIController.inbound214agistix(req);
                break;
            default:
                res.status(404);
                res.send('partner doesn\'t exist');
                return;
        }
        res.status(501);
        res.json(payload);
    }

    static async outbound214(req, res)
    {
        for (const param of ['partner', 'bol'])
        {
            if (!(req.query[param]))
            {
                res.status(400);
                res.send(`missing ${param} in query parameter`);
                return;
            }
        }

        let payload;
        switch (req.query.partner)
        {
            case '7147617300':
                // this is yamaha partner id
                if (!req.query.shipmentId)
                {
                    res.status(400);
                    res.send('missing shipmentId in query parameter');
                    return;
                }
                payload = await EDIController.outbound214yamaha(req);
                break;
            case 'AGTX':
                // this is the agistix
                payload = await EDIController.outbound214agistix(req);
                break;
            default:
                res.status(404);
                res.send('partner doesn\'t exist');
                return;
        }

        res.status(200);
        res.json(payload);
    }

    static async inbound214yamaha(req)
    {
        // i dont think i will be sending anything
        return;
    }

    static async outbound214yamaha(req)
    {
        const dt = DateTime.now().toUTC();

        const statusUpdate = {

            // CCYYMMDD
            'date': dt.toFormat(EDI_DATE_FORMAT),

            // HHMMSS
            'time': dt.toFormat(EDI_TIME_FORMAT),
            'timezone': 'UT',

            // [2-30]
            'city': faker.address.cityName().substr(0, 30),

            // [2]
            'state': faker.address.stateAbbr().substr(0, 2),

            // [2-3]
            'country': faker.address.countryCode().substr(0, 3)
        };

        if (Math.random() > 0.5)
        {
            statusUpdate.shipmentCode = faker.random.arrayElement(shipmentStatusCodes);
            statusUpdate.shipmentStatus = faker.random.arrayElement(shipmentStatusCodeReason);
        }
        else
        {
            statusUpdate.appointmentCode = faker.random.arrayElement(shipmentAppointmentStatusCode);
            statusUpdate.appointmentStatus = faker.random.arrayElement(shipmentStatusCodeReason);
        }

        return [
            {
                bol: req.query.bol,
                scac: SCAC_CODE,

                // optional order number or invoice number
                referenceNo: faker.random.alphaNumeric(8).toUpperCase(),
                instructions: [
                    {
                        value: 'Yamaha',
                        qualifier: 'ZZ'
                    },
                    {
                        value: req.query.shipmentId,
                        qualifier: 'SH'
                    }
                ],
                '0200': [
                    {
                        instructions: [
                            {
                                // yamaha BOL for respective stop (needed during delivery status)
                                value: req.query.bol,
                                qualifier: 'BM'
                            }
                        ],
                        '0205': [statusUpdate]
                    }
                ]
            }
        ];
    }

    static async inbound214agistix(req)
    {
        return;
    }

    static async outbound214agistix(req)
    {
        return {
            'a': 'b'
        };
    }
}

const controller = new EDIController();
module.exports = controller;