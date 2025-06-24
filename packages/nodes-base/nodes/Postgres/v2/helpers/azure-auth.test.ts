import type { AccessToken, TokenCredential } from '@azure/identity';
import { AzureAuthenticationError } from 'n8n-workflow';

import { AzurePostgresAuth } from './azure-auth';

// Mock the Azure identity module
jest.mock('@azure/identity', () => ({
	DefaultAzureCredential: jest.fn(),
	ClientSecretCredential: jest.fn(),
}));

describe('AzurePostgresAuth', () => {
	let mockCredential: jest.Mocked<TokenCredential>;
	let mockToken: AccessToken;

	beforeEach(() => {
		// Create mock token that expires in 1 hour
		mockToken = {
			token: 'mock-access-token',
			expiresOnTimestamp: Date.now() + 3600 * 1000,
		};

		// Create mock credential
		mockCredential = {
			getToken: jest.fn().mockResolvedValue(mockToken),
		};

		jest.clearAllMocks();
	});

	describe('Service Principal Authentication', () => {
		it('should create ClientSecretCredential for service principal', async () => {
			const { ClientSecretCredential } = await import('@azure/identity');
			(ClientSecretCredential as jest.Mock).mockReturnValue(mockCredential);

			const azureAuth = new AzurePostgresAuth({
				tenantId: 'tenant-123',
				clientId: 'client-123',
				clientSecret: 'secret-123',
			});

			const token = await azureAuth.getToken();

			expect(ClientSecretCredential).toHaveBeenCalledWith('tenant-123', 'client-123', 'secret-123');
			expect(mockCredential.getToken).toHaveBeenCalledWith(
				'https://ossrdbms-aad.database.windows.net/.default',
			);
			expect(token).toBe('mock-access-token');
		});
	});

	describe('User-assigned Managed Identity', () => {
		it('should create DefaultAzureCredential with client ID', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

			const azureAuth = new AzurePostgresAuth({
				clientId: 'client-123',
			});

			const token = await azureAuth.getToken();

			expect(DefaultAzureCredential).toHaveBeenCalledWith({
				managedIdentityClientId: 'client-123',
			});
			expect(token).toBe('mock-access-token');
		});
	});

	describe('System-assigned Managed Identity', () => {
		it('should create DefaultAzureCredential without options', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

			const azureAuth = new AzurePostgresAuth({});

			const token = await azureAuth.getToken();

			expect(DefaultAzureCredential).toHaveBeenCalledWith();
			expect(token).toBe('mock-access-token');
		});
	});

	describe('Token Refresh Logic', () => {
		it('should refresh token when close to expiry', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

			// Create token that expires in 4 minutes (less than 5 minute default margin)
			const nearExpiryToken = {
				token: 'old-token',
				expiresOnTimestamp: Date.now() + 4 * 60 * 1000,
			};
			const newToken = {
				token: 'new-token',
				expiresOnTimestamp: Date.now() + 3600 * 1000,
			};

			mockCredential.getToken
				.mockResolvedValueOnce(nearExpiryToken)
				.mockResolvedValueOnce(newToken);

			const azureAuth = new AzurePostgresAuth({});

			// First call gets the near-expiry token
			const firstToken = await azureAuth.getToken();
			expect(firstToken).toBe('old-token');

			// Second call should refresh and get new token
			const secondToken = await azureAuth.getToken();
			expect(secondToken).toBe('new-token');
			expect(mockCredential.getToken).toHaveBeenCalledTimes(2);
		});

		it('should use custom refresh margin', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);

			// Create token that expires in 59 seconds (within 60 second margin)
			const soonExpiryToken = {
				token: 'old-token',
				expiresOnTimestamp: Date.now() + 59 * 1000,
			};
			const newToken = {
				token: 'new-token',
				expiresOnTimestamp: Date.now() + 3600 * 1000,
			};

			mockCredential.getToken
				.mockResolvedValueOnce(soonExpiryToken)
				.mockResolvedValueOnce(newToken);

			// Set refresh margin to 60 seconds
			const azureAuth = new AzurePostgresAuth({
				tokenRefreshMargin: 60,
			});

			// First call gets the soon-expiry token
			const firstToken = await azureAuth.getToken();
			expect(firstToken).toBe('old-token');

			// Second call should refresh because token expires within 60 seconds
			const secondToken = await azureAuth.getToken();
			expect(secondToken).toBe('new-token');
		});
	});

	describe('Error Handling', () => {
		it('should throw AzureAuthenticationError when token is null', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);
			mockCredential.getToken.mockResolvedValue(null);

			const azureAuth = new AzurePostgresAuth({});

			await expect(azureAuth.getToken()).rejects.toThrow(AzureAuthenticationError);
			await expect(azureAuth.getToken()).rejects.toThrow('Token is null');
		});

		it('should throw AzureAuthenticationError when credential initialization fails', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockImplementation(() => {
				throw new Error('Credential initialization failed');
			});

			const azureAuth = new AzurePostgresAuth({});

			await expect(azureAuth.getToken()).rejects.toThrow(AzureAuthenticationError);
			await expect(azureAuth.getToken()).rejects.toThrow('Credential initialization failed');
		});

		it('should throw AzureAuthenticationError when token acquisition fails', async () => {
			const { DefaultAzureCredential } = await import('@azure/identity');
			(DefaultAzureCredential as jest.Mock).mockReturnValue(mockCredential);
			mockCredential.getToken.mockRejectedValue(new Error('Token acquisition failed'));

			const azureAuth = new AzurePostgresAuth({});

			await expect(azureAuth.getToken()).rejects.toThrow(AzureAuthenticationError);
			await expect(azureAuth.getToken()).rejects.toThrow('Token acquisition failed');
		});
	});
});
