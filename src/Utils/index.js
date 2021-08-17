const METERS_RATE = 1609.34;

const MilesToMeters = (miles) =>
{
    return miles * METERS_RATE;
};

module.exports = { MilesToMeters };