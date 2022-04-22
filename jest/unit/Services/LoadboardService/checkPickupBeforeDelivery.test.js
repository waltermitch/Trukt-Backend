/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable padding-line-between-statements */
const { DateTime } = require('luxon');
const { DataConflictError, ValidationError } = require('../../../../src/ErrorHandling/Exceptions');

const { checkPickupBeforeDelivery } = require('../../../../src/Services/LoadboardService');

describe('Test pickup and delivery date validation', () =>
{
    it('pickup before delivery', () =>
    {

        // time     ---------->
        // pickup   =
        // delivery  =
        const pickup = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const delivery = pickup.plus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickup, null, delivery, null);
        };

        expect(t).not.toThrow(Error);
    });

    it('pickup exactly the same as delivery', () =>
    {
        // time     ---------->
        // pickup   =
        // delivery =
        const pickup = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const delivery = pickup;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickup, null, delivery, null);
        };

        expect(t).not.toThrow(Error);
    });

    it('pickup date after delivery date', () =>
    {
        // time     ---------->
        // pickup    =
        // delivery =
        const pickup = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const delivery = pickup.minus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickup, null, delivery, null);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('pickup date range before delivery date range', () =>
    {
        // time     ---------->
        // pickup   ===
        // delivery    ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 1 });
        const deliveryStart = pickupEnd.plus({ minutes: 1 });
        const deliveryEnd = deliveryStart.plus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).not.toThrow(Error);
    });

    it('pickup starts before delivery, delivery starts before pickup ends', () =>
    {
        // time     ---------->
        // pickup   ===
        // delivery  ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 2 });
        const deliveryStart = pickupStart.plus({ minutes: 1 });
        const deliveryEnd = pickupEnd.plus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).not.toThrow(Error);
    });

    it('delivery range inside of pickup range', () =>
    {
        // time     ---------->
        // pickup   ====
        // delivery  ==
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.plus({ minutes: 1 });
        const deliveryEnd = pickupStart.plus({ minutes: 2 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('pickup range inside of delivery range', () =>
    {
        // time     ---------->
        // pickup    ==
        // delivery ====
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd.plus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('delivery starts before pickup, delivery ends before pickup', () =>
    {
        // time     ---------->
        // pickup    ===
        // delivery ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd.minus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('delivery range before pickup range', () =>
    {
        // time     ---------->
        // pickup      ===
        // delivery ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd.minus({ minutes: 1 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('pickup range same as delivery range', () =>
    {
        // time     ---------->
        // pickup   ===
        // delivery ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart;
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).not.toThrow(Error);
    });

    it('pickup range extends past deliver range', () =>
    {
        // time     ---------->
        // pickup   ====
        // delivery ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart;
        const deliveryEnd = pickupEnd.minus({ minutes: 2 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('delivery range extends past pickup range', () =>
    {
        // time     ---------->
        // pickup   ===
        // delivery ====
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart;
        const deliveryEnd = pickupEnd.plus({ minutes: 2 });

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).not.toThrow(Error);
    });

    it('pickup range extends before deliver range', () =>
    {
        // time     ---------->
        // pickup   ====
        // delivery  ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.plus({ minutes: 1 });
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).not.toThrow(Error);
    });

    it('delivery range extends before pickup range', () =>
    {
        // time     ---------->
        // pickup    ===
        // delivery ====
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('pickup dates are inversed', () =>
    {
        // time     ---------->
        // pickup   =   =
        // delivery  ===
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupEnd, pickupStart, deliveryStart, deliveryEnd);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('delivery dates are inversed', () =>
    {
        // time     ---------->
        // pickup      ===
        // delivery   =   =
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupStart, pickupEnd, deliveryEnd, deliveryStart);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('all dates are inversed', () =>
    {
        // time     ---------->
        // pickup      =    =
        // delivery   =   =
        const pickupStart = DateTime.fromISO('2022-04-01T17:23:11.330-07:00');
        const pickupEnd = pickupStart.plus({ minutes: 3 });
        const deliveryStart = pickupStart.minus({ minutes: 1 });
        const deliveryEnd = pickupEnd;

        const t = () =>
        {
            checkPickupBeforeDelivery(pickupEnd, pickupStart, deliveryEnd, deliveryStart);
        };

        expect(t).toThrow(DataConflictError);
    });

    it('everything is undefined', () =>
    {
        const t = () =>
        {
            checkPickupBeforeDelivery(undefined, undefined, undefined, undefined);
        };

        expect(t).toThrow(ValidationError);
    });

    it('pickup start is undefined', () =>
    {
        const date = DateTime.now();
        const t = () =>
        {
            checkPickupBeforeDelivery(undefined, date, date, date);
        };

        expect(t).toThrow(ValidationError);
    });

    it('delivery start is undefined', () =>
    {
        const date = DateTime.now();
        const t = () =>
        {
            checkPickupBeforeDelivery(date, date, undefined, date);
        };

        expect(t).toThrow(ValidationError);
    });
});