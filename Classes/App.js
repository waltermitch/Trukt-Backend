const ErrorHandler = require('./ErrorHandler');

class App {
	constructor() {}

	static async next(context, func, params) {
		if (!Array.isArray(params)) params = [params];

		let response = {};

		try {
			response = await func(context, ...params);
		} catch (err) {
			response = new ErrorHandler(context, err);
		}

		context.res = {
			headers: { 'Content-Type': 'application/json' },
			status: response?.status,
			body: response,
		};
	}

	static async timer(context, func) {
		let response = {};

		try {
			response = await func();
		} catch (err) {
			response = new ErrorHandler(context, err);
		} finally {
			context.log(response);
		}
	}

	static resolve(context, response) {
		context.res = {
			headers: { 'Content-Type': 'application/json' },
			status: response?.status,
			body: response,
		};
	}
}

module.exports = App;
