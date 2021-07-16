const ErrorHandler = require('../ErrorHandler');

class HttpRouteController
{
    /* eslint-disable */
    async handleGet()
    {
        return { 'status': 501 };
    }

    async handlePost()
    {
        return { 'status': 501 };
    }

    async handlePut()
    {
        return { 'status': 501 };
    }

    async handlePatch()
    {
        return { 'status': 501 };
    }

    async handleDelete()
    {
        return { 'status': 501 };
    }

    /* eslint-enable */
    // async handleHttp(context, request)
    // {
    //     // we get no JS access in the function.json so have to do introspection
    //     let response = undefined;

    //     // response should mimic the http response at the top level
    //     // setting the status, body and headers etc.
    //     try
    //     {
    //         switch (request.method)
    //         {
    //             case 'GET':
    //                 response = await this.handleGet(context, request);
    //                 break;
    //             case 'POST':
    //                 response = await this.handlePost(context, request);
    //                 break;
    //             case 'PUT':
    //                 response = await this.handlePut(context, request);
    //                 break;
    //             case 'PATCH':
    //                 response = await this.handlePatch(context, request);
    //                 break;
    //             case 'DELETE':
    //                 response = await this.handleDelete(context, request);
    //                 break;
    //         }
    //     }
    //     catch (err)
    //     {
    //         context.log(err);

    //         // handle generic errors here?
    //         const errResp = new ErrorHandler(context, err);
    //         response =
    //         {
    //             status: errResp.status,
    //             body: errResp.data
    //         };
    //     }
    //     finally
    //     {
    //         if (response)

    //             // conditionally assign the properties
    //             // dont assign if they are falsey
    //             for (const prop in response)
    //                 if (response[prop])
    //                     context.res[prop] = response[prop];

    //         // set the default Content-Type to application/json
    //         if (!context?.res?.headers?.['Content-Type'])
    //             context.res.headers['Content-Type'] = 'application/json';
    //     }

    // }

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
