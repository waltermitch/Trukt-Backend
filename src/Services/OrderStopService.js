const OrderStopLink = require('../Models/OrderStopLink');
const OrderStop = require('../Models/OrderStop');

class OrderStopService
{
    /*
    Business Logic:
    You will also need the Order’s OrderStopLinks.

    When the status is “started” you will only mark the OrderStopLinks is_started column
    and set the date_started field to the date field value from the payload.

    When the status is “completed” you will mark the OrderStopLinks is_started
    and is_completed column.
    Set the date_completed column to the date field value from the payload.
    If is_started is empty and date_started is null, then update the date_started to the date field value from the payload.

    You will need to update the OrderStopLinks for the Order based on the status of the Jobs' OrderStopLinks.
    Query for all of the OrderStopLinks that belong to each OrderStop that belong to an Order.
    Check the OrderStopLinks are “started” that belong ONLY to the Jobs.
    If ANY of the Jobs' commodity’s OrderStopLinks are “started”, then set the Order’s OrderStopLinks to “is_started” for that commodity.
    Set the date to the earliest is_started date.
    Check the OrderStopLinks are  “completed” that belong ONLY to the Jobs.
    If ALL of the Jobs' commodity’s OrderStopLinks are “completed”, then set the Order’s OrderStopLinks to “completed” for that commodity.
    Set the date to the latest is_completed date.
    If ANY of the commoditys' OrderStopLinks are “started” for a particular OrderStop, then set the “date_started” of the OrderStop to the earliest date from the OrderStopLinks and set “started” column.
    Set the “status” column to “En Route” irrelevant if the OrderStop type is “delivery” or “pickup”.
    If ALL of the commoditys' OrderStopLinks are “completed” for a particular OrderStop, then set the “date_completed” of the OrderStop to the latest date from the OrderStopLinks and set “completed” column to true.
    Set the “status” column to “Picked Up” or “Delivered” based on the OrderStop type.
    Add status update to the status manager based on the OrderStop status if it changed. (This is the activity log.)
    “Stop Marked Picked Up” - include the stop guid and commodities to the activity log.
    “Stop Marked Delivered” - include the stop guid and commodities to the activity log.
    Notify the Order State manager that the order was updated. (State manager will update the status of the order and jobs)
    */
    static async updateStopStatus({ jobGuid, stopGuid, status }, { commodities, date })
    {
        // update array
        const updates = [];

        // Find the proper OrderStopLinks based on the commodity guids, job guid and stop guid.
        const links = await OrderStopLink.query().where({ 'job_guid': jobGuid, 'stop_guid': stopGuid }).whereIn('commodity_guid', commodities);

        const linksPayload = {};

        if (status === 'started')
        {
            linksPayload.is_started = true;
            linksPayload.date_started = date;
        }
        else if (status === 'completed')
        {
            linksPayload.is_started = true;
            linksPayload.is_completed = true;
            linksPayload.date_completed = date;
        }

        // check the status of the links if the current update is the "completed one"
        for (const link of links)
        {
            if (link.is_started)
            {
                updates.push(OrderStopLink.query().update(linksPayload).where({ id: link.id }));
            }
        }
    }
}

module.exports = OrderStopService;