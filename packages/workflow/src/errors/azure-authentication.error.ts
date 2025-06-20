import { ApplicationError } from './application.error';

export type AzureAuthenticationErrorOpts = {
	cause?: Error;
	operation: 'initialization' | 'token_acquisition' | 'token_refresh';
};

export class AzureAuthenticationError extends ApplicationError {
	constructor(message: string, opts: AzureAuthenticationErrorOpts) {
		const errorMessage = `Azure authentication failed during ${opts.operation}: ${message}`;
		super(errorMessage, { cause: opts.cause });
	}
}
