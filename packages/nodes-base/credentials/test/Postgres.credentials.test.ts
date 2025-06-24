import { Postgres } from '../Postgres.credentials';

describe('Postgres Credential', () => {
	const postgres = new Postgres();

	it('should have correct properties', () => {
		expect(postgres.name).toBe('postgres');
		expect(postgres.displayName).toBe('Postgres');
		expect(postgres.documentationUrl).toBe('postgres');
		expect(postgres.properties.length).toBeGreaterThan(0);
	});

	it('should have authentication type selector as first property', () => {
		const authTypeProperty = postgres.properties[0];
		expect(authTypeProperty.name).toBe('authenticationType');
		expect(authTypeProperty.type).toBe('options');
		expect(authTypeProperty.default).toBe('password');
		expect(authTypeProperty.options).toEqual([
			{
				name: 'Username & Password',
				value: 'password',
			},
			{
				name: 'Azure Managed Identity',
				value: 'azure_managed_identity',
			},
		]);
	});

	it('should have conditional password fields', () => {
		const userProperty = postgres.properties.find((p) => p.name === 'user');
		const passwordProperty = postgres.properties.find((p) => p.name === 'password');

		expect(userProperty?.displayOptions?.show?.authenticationType).toEqual(['password']);
		expect(passwordProperty?.displayOptions?.show?.authenticationType).toEqual(['password']);
		expect(passwordProperty?.typeOptions?.password).toBe(true);
	});

	it('should have Azure-specific fields with conditional display', () => {
		const azureTenantId = postgres.properties.find((p) => p.name === 'azureTenantId');
		const azureClientId = postgres.properties.find((p) => p.name === 'azureClientId');
		const azureClientSecret = postgres.properties.find((p) => p.name === 'azureClientSecret');
		const tokenRefreshMargin = postgres.properties.find((p) => p.name === 'tokenRefreshMargin');

		// Check that Azure fields exist and have conditional display
		expect(azureTenantId?.displayOptions?.show?.authenticationType).toEqual([
			'azure_managed_identity',
		]);
		expect(azureClientId?.displayOptions?.show?.authenticationType).toEqual([
			'azure_managed_identity',
		]);
		expect(azureClientSecret?.displayOptions?.show?.authenticationType).toEqual([
			'azure_managed_identity',
		]);
		expect(tokenRefreshMargin?.displayOptions?.show?.authenticationType).toEqual([
			'azure_managed_identity',
		]);

		// Check that Azure client secret is a password field
		expect(azureClientSecret?.typeOptions?.password).toBe(true);

		// Check token refresh margin default
		expect(tokenRefreshMargin?.default).toBe(300);
	});

	it('should have required database connection fields', () => {
		const requiredFields = ['host', 'database', 'port', 'maxConnections'];

		requiredFields.forEach((fieldName) => {
			const field = postgres.properties.find((p) => p.name === fieldName);
			expect(field).toBeDefined();
		});

		// Check defaults
		const hostField = postgres.properties.find((p) => p.name === 'host');
		const databaseField = postgres.properties.find((p) => p.name === 'database');
		const portField = postgres.properties.find((p) => p.name === 'port');

		expect(hostField?.default).toBe('localhost');
		expect(databaseField?.default).toBe('postgres');
		expect(portField?.default).toBe(5432);
	});
});
