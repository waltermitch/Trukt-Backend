const Microsoft = require('../Azure/Microsoft');
const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../ErrorHandling/Exceptions');

const appId = process.env.AZURE_AD_APPID;

class Auth
{
    static async verifyJWT(token)
    {
        if (!token)
            throw new AuthenticationError('Invalid Token');

        // remove bearer and ensure no empty strings
        const cleanToken = Auth.extractToken(token);

        // decode full token
        const decoded = jwt.decode(cleanToken, { complete: true });

        // oid is the unique identifier for the user
        // aud is the audience for the token (groupId)
        if (!decoded || !decoded.payload?.oid || decoded.payload?.aud != appId)
            throw new AuthenticationError('Invalid Token');

        // get keys
        const keys = await Microsoft.getKeys();

        // try to validate token
        try
        {
            return jwt.verify(cleanToken, keys.get(decoded?.header?.kid).secret);
        }
        catch (err)
        {
            throw new AuthenticationError('Invalid Token');
        }
    }

    static extractToken(bearer)
    {
        const token = bearer.split(' ')[1];

        // verify length
        if (token?.length <= 40 || !token?.startsWith('e'))
            throw new AuthenticationError('Invalid Token');

        return token;
    }
}

module.exports = Auth;