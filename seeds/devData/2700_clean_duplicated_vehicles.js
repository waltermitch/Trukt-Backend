const { raw } = require('objection');
const Vehicle = require('../../src/Models/Vehicle');
const Commodity = require('../../src/Models/Commodity');

/**
 * Process: We want to delete only the vehicles that are not used in commodities table, so we only delete unused duplcaited entries.
 * 1. Get the duplciated vehicles grouped by year, make, model, trim and weight_class_id
 * 2. For each vehicle group we find one so we have the vehicle ID.
 * 3. Update the commodities that use this group of vehicle and set the vehicle_id to the one found. At this point all commodities
 * that were using the same kind of vehicle would be using the same one, so the other ones can be deleted without error
 * 4. Get the vehicles that are not being used in any commodity
 * 5. Delete unused vehicles. At this point there should no be duplicated vehicles
 * @param {*} trx
 * @returns
 */
exports.seed = async function (trx)
{

    // Step 1
    const duplicateVehiclesList = await Vehicle.query(trx).select('year', 'make', 'model', 'trim', 'weight_class_id', raw('COUNT(*)'))
        .groupBy('year', 'make', 'model', 'trim', 'weight_class_id')
        .having(raw('COUNT(*) > 1'));

    // Step 2
    const vehiclePerGroup = duplicateVehiclesList.map(vehicleDataGrouped =>
    {
        const { count, ...vehicleData } = vehicleDataGrouped;
        return Vehicle.query(trx).findOne(vehicleData);
    });
    const vehicleFoundPerGroup = await Promise.all(vehiclePerGroup);

    // Step 3
    const vehiclesIdsPerGroupPromise = vehicleFoundPerGroup.map(({ year, make, model, trim, weightClassId }) =>
    {
        return Vehicle.query(trx).select('id')
            .where({
                year,
                make,
                model,
                trim,
                weightClassId
            });
    });
    const vehiclesIdsPerGroup = await Promise.all(vehiclesIdsPerGroupPromise);

    const commoditiesToUpdate = vehicleFoundPerGroup.map(({ id }, positionInvehicleFoundPerGroup) =>
    {
        const vehiclesIds = vehiclesIdsPerGroup[positionInvehicleFoundPerGroup].map(vehicle => `${vehicle.id}`);
        return Commodity.query(trx).patch({ 'vehicle_id': id })
            .whereIn('vehicle_id', vehiclesIds);
    });

    await Promise.all(commoditiesToUpdate);

    // Step 4
    const vehiclesUseInCommodities = Commodity.query(trx).select('vehicleId').whereNotNull('vehicleId')
        .groupBy('vehicleId');

    // Step 5
    await Vehicle.query(trx).delete().whereNotIn('id', vehiclesUseInCommodities);

    return trx;
};
