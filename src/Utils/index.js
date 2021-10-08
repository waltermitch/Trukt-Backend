const { DateTime } = require('luxon');

const METERS_RATE = 1609.34;

const MilesToMeters = (miles) =>
{
    return miles * METERS_RATE;
};

const parseDate = function (date)
{
    return date === null ? null : DateTime.fromSQL(date).toISO();
};

module.exports = { MilesToMeters, parseDate };