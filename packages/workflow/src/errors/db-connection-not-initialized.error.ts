import { ApplicationError } from './application.error';

export class DbConnectionNotInitializedError extends ApplicationError {
	constructor() {
		const errorMessage =
			'Database connection is not initialized. The init() method must be called before attempting database operations.';
		super(errorMessage);
	}
}
