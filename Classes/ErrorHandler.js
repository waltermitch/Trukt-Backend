class ErrorHandler {
	constructor(context, err) {
		this.catchError(context, err);
	}

	catchError(context, err) {
		if (err?.response?.data) {
			this.status = err.response.status;

			this.data = err.response.data;
		} else if (err?.reason?.response) {
			this.status = err.reason?.response?.status;

			this.data = err.reason?.response?.data;
		} else if (err?.reason) {
			this.data = err.reason;
		} else if (err?.status && err.data) {
			this.status = err.status;

			this.data = err.data;
		} else if (err?.errors || err?.error) {
			this.status = 500;

			this.data = err;
		} else {
			this.status = 500;

			this.data = err.toString();
		}

		context.log(err);
	}
}

module.exports = ErrorHandler;
