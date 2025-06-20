import type { GlobalConfig, InstanceSettingsConfig } from '@n8n/config';
import { mysqlMigrations } from '@n8n/db';
import { postgresMigrations } from '@n8n/db';
import { sqliteMigrations } from '@n8n/db';
import { mock } from 'jest-mock-extended';
import path from 'path';

import type { ModuleRegistry } from '@/modules/module-registry';

import { DbConnectionOptions } from '../db-connection-options';

describe('DbConnectionOptions', () => {
	const dbConfig = mock<GlobalConfig['database']>({
		tablePrefix: 'test_prefix_',
		logging: {
			enabled: false,
			maxQueryExecutionTime: 0,
		},
	});
	const n8nFolder = '/test/n8n';
	const instanceSettingsConfig = mock<InstanceSettingsConfig>({ n8nFolder });
	const moduleRegistry = mock<ModuleRegistry>({ entities: [] });
	const dbConnectionOptions = new DbConnectionOptions(
		dbConfig,
		instanceSettingsConfig,
		moduleRegistry,
	);

	beforeEach(() => jest.resetAllMocks());

	const commonOptions = {
		entityPrefix: 'test_prefix_',
		entities: expect.any(Array),
		subscribers: expect.any(Array),
		migrationsTableName: 'test_prefix_migrations',
		migrationsRun: false,
		synchronize: false,
		maxQueryExecutionTime: 0,
		logging: false,
	};

	describe('getOptions', () => {
		it('should throw an error for unsupported database types', async () => {
			// @ts-expect-error invalid type
			dbConfig.type = 'unsupported';

			await expect(dbConnectionOptions.getOptions()).rejects.toThrow(
				'Database type currently not supported',
			);
		});

		describe('for SQLite', () => {
			beforeEach(() => {
				dbConfig.type = 'sqlite';
				dbConfig.sqlite = {
					database: 'test.sqlite',
					poolSize: 0,
					enableWAL: false,
					executeVacuumOnStartup: false,
				};
			});

			it('should return SQLite connection options when type is sqlite', async () => {
				const result = await dbConnectionOptions.getOptions();

				expect(result).toEqual({
					type: 'sqlite',
					enableWAL: false,
					...commonOptions,
					database: path.resolve(n8nFolder, 'test.sqlite'),
					migrations: sqliteMigrations,
				});
			});

			it('should return SQLite connection options with pooling when poolSize > 0', async () => {
				dbConfig.sqlite.poolSize = 5;

				const result = await dbConnectionOptions.getOptions();

				expect(result).toEqual({
					type: 'sqlite-pooled',
					poolSize: 5,
					enableWAL: true,
					acquireTimeout: 60_000,
					destroyTimeout: 5_000,
					...commonOptions,
					database: path.resolve(n8nFolder, 'test.sqlite'),
					migrations: sqliteMigrations,
				});
			});
		});

		describe('PostgreSQL', () => {
			beforeEach(() => {
				dbConfig.type = 'postgresdb';
				dbConfig.postgresdb = {
					database: 'test_db',
					host: 'localhost',
					port: 5432,
					user: 'postgres',
					password: 'password',
					schema: 'public',
					poolSize: 2,
					connectionTimeoutMs: 20000,
					authType: 'password',
					azureTenantId: '',
					azureClientId: '',
					azureClientSecret: '',
					azureTokenRefreshMargin: 300000,
					ssl: {
						enabled: false,
						ca: '',
						cert: '',
						key: '',
						rejectUnauthorized: true,
					},
					idleTimeoutMs: 30000,
				};
			});

			it('should return PostgreSQL connection options when type is postgresdb', async () => {
				const result = await dbConnectionOptions.getOptions();

				expect(result).toEqual({
					type: 'postgres',
					...commonOptions,
					database: 'test_db',
					host: 'localhost',
					port: 5432,
					username: 'postgres',
					password: 'password',
					schema: 'public',
					poolSize: 2,
					migrations: postgresMigrations,
					connectTimeoutMS: 20000,
					ssl: false,
					extra: {
						idleTimeoutMillis: 30000,
					},
				});
			});

			it('should configure SSL options for PostgreSQL when SSL settings are provided', async () => {
				const ssl = {
					ca: 'ca-content',
					cert: 'cert-content',
					key: 'key-content',
					rejectUnauthorized: false,
				};
				dbConfig.postgresdb.ssl = { enabled: true, ...ssl };

				const result = await dbConnectionOptions.getOptions();

				expect(result).toMatchObject({ ssl });
			});

			it('should return password authentication overrides by default', async () => {
				const result = await dbConnectionOptions.getPostgresOverrides();

				expect(result).toEqual({
					database: 'test_db',
					host: 'localhost',
					port: 5432,
					username: 'postgres',
					password: 'password',
				});
			});

			it('should detect Azure authentication is disabled by default', () => {
				// Using bracket notation to access private method for testing
				const isAzureEnabled = (dbConnectionOptions as any).isAzureAuthEnabled();
				expect(isAzureEnabled).toBe(false);
			});

			it('should detect Azure authentication when enabled', () => {
				dbConfig.postgresdb.authType = 'azure_entra_id';

				const isAzureEnabled = (dbConnectionOptions as any).isAzureAuthEnabled();
				expect(isAzureEnabled).toBe(true);
			});
		});

		describe('for MySQL / MariaDB', () => {
			beforeEach(() => {
				dbConfig.mysqldb = {
					database: 'test_db',
					host: 'localhost',
					port: 3306,
					user: 'root',
					password: 'password',
				};
			});

			it('should return MySQL connection options when type is mysqldb', async () => {
				dbConfig.type = 'mysqldb';

				const result = await dbConnectionOptions.getOptions();

				expect(result).toEqual({
					type: 'mysql',
					...commonOptions,
					database: 'test_db',
					host: 'localhost',
					port: 3306,
					username: 'root',
					password: 'password',
					migrations: mysqlMigrations,
					timezone: 'Z',
				});
			});

			it('should return MariaDB connection options when type is mariadb', async () => {
				dbConfig.type = 'mariadb';

				const result = await dbConnectionOptions.getOptions();

				expect(result).toEqual({
					type: 'mariadb',
					...commonOptions,
					database: 'test_db',
					host: 'localhost',
					port: 3306,
					username: 'root',
					password: 'password',
					migrations: mysqlMigrations,
					timezone: 'Z',
				});
			});
		});

		describe('logging', () => {
			beforeEach(() => {
				dbConfig.type = 'sqlite';
				dbConfig.sqlite = mock<GlobalConfig['database']['sqlite']>({ database: 'test.sqlite' });
			});

			it('should not configure logging by default', async () => {
				const result = await dbConnectionOptions.getOptions();

				expect(result.logging).toBe(false);
			});

			it('should configure logging when it is enabled', async () => {
				dbConfig.logging = {
					enabled: true,
					options: 'all',
					maxQueryExecutionTime: 1000,
				};

				const result = await dbConnectionOptions.getOptions();

				expect(result.logging).toBe('all');
				expect(result.maxQueryExecutionTime).toBe(1000);
			});
		});
	});
});
