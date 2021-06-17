const ErrorHandler = require('../ErrorHandler');

class HttpRouteController
{
    /* eslint-disable */
    async handleGet(context, request)
    {
        return { 'status': 501 };
    }

    async handlePost(context, request)
    {
        return { 'status': 501 };
    }

    async handlePut(context, request)
    {
        return { 'status': 501 };
    }

    async handlePatch(context, request)
    {
        return { 'status': 501 };
    }

    async handleDelete(context, request)
    {
        return { 'status': 501 };
    }

    /* eslint-enable */
    async handleHttp(context, request)
    {
        // we get no JS access in the function.json so have to do introspection
        let response = {};

        try
        {
            switch (request.method)
            {
                case 'GET':
                    response = await this.handleGet(context, request);
                    break;
                case 'POST':
                    response = await this.handlePost(context, request);
                    break;
                case 'PUT':
                    response = await this.handlePut(context, request);
                    break;
                case 'PATCH':
                    response = await this.handlePatch(context, request);
                    break;
                case 'DELETE':
                    response = await this.handleDelete(context, request);
                    break;
            }
        }
        catch (err)
        {
            context.log(err);

            // handle generic errors here?
            response = new ErrorHandler(context, err);

        }

        context.res =
        {
            status: response?.status,
            body: response,
            headers: { 'Content-Type': 'application/json' }
        };

    }

    onlyOne(context, result)
    {
        if (result.length > 0)
        {
            context.res.status = 200;
            context.res.body = result[0];
        }
        else
        { context.res.status = 404; }

    }

    static async next(context, func, params)
    {
        if (!Array.isArray(params)) params = [params];

        let response = {};

        try
        {
            response = await func(context, ...params);
        }
        catch (err)
        {
            response = new ErrorHandler(context, err);
        }

        context.res =
        {
            headers: { 'Content-Type': 'application/json' },
            status: response?.status,
            body: response
        };
    }

    static async timer(context, func)
    {
        let response = {};

        try
        {
            response = await func();
        }
        catch (err)
        {
            response = new ErrorHandler(context, err);
        }
        finally
        {
            context.log(response);
        }
    }

    static resolve(context, response)
    {
        context.res = {
            headers: { 'Content-Type': 'application/json' },
            status: response?.status,
            body: response
        };
    }
}

module.exports = HttpRouteController;
