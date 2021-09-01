const AuthController = require('../AuthController');
const ErrorHandler = require('../ErrorHandler');

let ship;

class ShipCar
{
    constructor() { }

    static async getShip()
    {
        if (ship?.expCheck())
        {
            const options = {
                url: 'https://staging.ship.cars/api',
                tokenName: 'sshipcars_access_token_staging'
            };

            ship = new AuthController(options);

            const token = await ship?.getSecret({ 'name': ship.tokenName });

            ship.exp = token.exp;

            if (!ship.instance)
                ship?.connect();

            ship.setToken(token.value);
        }

        return ship.instance;
    }

    static async acceptLoadRequest(requestPostID, offerPayload)
    {
        const ship = await ShipCar.getShip();

        const response = await ship.post(`/negotiations/${requestPostID}/accept/`, offerPayload);

        return response?.data;
    }

    static async declineLoadRequest(requestPostID)
    {
        const ship = await ShipCar.getShip();

        const response = await ship.post(`/negotiations/${requestPostID}/cancel/`);

        return response.data;
    }
}

module.exports = ShipCar;