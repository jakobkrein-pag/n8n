import type { AccessToken, TokenCredential } from '@azure/identity';
import { AzureAuthenticationError, ensureError } from 'n8n-workflow';

export interface AzureTokenConfig {
	tenantId?: string;
	clientId?: string;
	clientSecret?: string;
}

export class AzureTokenService {
	private credential?: TokenCredential;

	private cachedToken?: AccessToken;

	constructor(private readonly config: AzureTokenConfig) {}

	async getToken(): Promise<string> {
		await this.initializeCredentialIfNeeded();
		await this.refreshTokenIfNeeded();

		if (!this.cachedToken?.token) {
			throw new AzureAuthenticationError('No valid access token available', {
				operation: 'token_acquisition',
			});
		}

		return this.cachedToken.token;
	}

	private async initializeCredentialIfNeeded(): Promise<void> {
		if (this.credential) {
			return;
		}

		const { DefaultAzureCredential, ClientSecretCredential } = await import('@azure/identity');

		try {
			if (this.config.tenantId && this.config.clientId && this.config.clientSecret) {
				// Service principal authentication
				this.credential = new ClientSecretCredential(
					this.config.tenantId,
					this.config.clientId,
					this.config.clientSecret,
				);
			} else if (this.config.clientId) {
				// User-assigned managed identity
				this.credential = new DefaultAzureCredential({
					managedIdentityClientId: this.config.clientId,
				});
			} else {
				// System-assigned managed identity
				this.credential = new DefaultAzureCredential();
			}
		} catch (error) {
			throw new AzureAuthenticationError(ensureError(error).message, {
				operation: 'initialization',
				cause: ensureError(error),
			});
		}
	}

	private async refreshTokenIfNeeded(): Promise<void> {
		if (!this.credential) {
			throw new AzureAuthenticationError('Azure credential not initialized', {
				operation: 'token_refresh',
			});
		}

		// Check if we need to refresh the token (5 minute margin)
		const refreshMargin = 5 * 60 * 1000; // 5 minutes in ms
		const needsRefresh =
			!this.cachedToken || this.cachedToken.expiresOnTimestamp - Date.now() < refreshMargin;

		if (!needsRefresh) {
			return;
		}

		try {
			const token = await this.credential.getToken(
				'https://ossrdbms-aad.database.windows.net/.default',
			);
			if (!token) {
				throw new AzureAuthenticationError('Token is null', {
					operation: 'token_acquisition',
				});
			}
			this.cachedToken = token;
		} catch (error) {
			throw new AzureAuthenticationError(ensureError(error).message, {
				operation: 'token_acquisition',
				cause: ensureError(error),
			});
		}
	}
}
