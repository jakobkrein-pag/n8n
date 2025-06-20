import { inTest } from '@n8n/backend-common';
import { DatabaseConfig } from '@n8n/config';
import type { Migration } from '@n8n/db';
import { wrapMigration } from '@n8n/db';
import { Container, Service } from '@n8n/di';
import { DataSource } from '@n8n/typeorm';
import { ErrorReporter } from 'n8n-core';
import {
	DbConnectionTimeoutError,
	DbConnectionNotInitializedError,
	ensureError,
} from 'n8n-workflow';

import { Time } from '@/constants';

import { DbConnectionOptions } from './db-connection-options';

type ConnectionState = {
	connected: boolean;
	migrated: boolean;
};

@Service()
export class DbConnection {
	private dataSource?: DataSource;

	private pingTimer: NodeJS.Timeout | undefined;

	readonly connectionState: ConnectionState = {
		connected: false,
		migrated: false,
	};

	constructor(
		private readonly errorReporter: ErrorReporter,
		private readonly connectionOptions: DbConnectionOptions,
		private readonly databaseConfig: DatabaseConfig,
	) {
		// DataSource creation moved to init() method for async options support
	}

	async init(): Promise<void> {
		const { connectionState } = this;
		if (connectionState.connected) return;

		// Create DataSource if not already created
		if (!this.dataSource) {
			const options = await this.connectionOptions.getOptions();
			this.dataSource = new DataSource(options);
			Container.set(DataSource, this.dataSource);
		}

		try {
			await this.dataSource.initialize();
		} catch (e) {
			let error = ensureError(e);
			if (
				this.dataSource.options.type === 'postgres' &&
				error.message === 'Connection terminated due to connection timeout'
			) {
				error = new DbConnectionTimeoutError({
					cause: error,
					configuredTimeoutInMs: this.dataSource.options.connectTimeoutMS!,
				});
			}
			throw error;
		}

		connectionState.connected = true;
		if (!inTest) this.scheduleNextPing();
	}

	async migrate() {
		const { dataSource, connectionState } = this;
		if (!dataSource) {
			throw new DbConnectionNotInitializedError();
		}
		(dataSource.options.migrations as Migration[]).forEach(wrapMigration);
		await dataSource.runMigrations({ transaction: 'each' });
		connectionState.migrated = true;
	}

	async close() {
		if (this.pingTimer) {
			clearTimeout(this.pingTimer);
			this.pingTimer = undefined;
		}

		if (this.dataSource?.isInitialized) {
			await this.dataSource.destroy();
			this.connectionState.connected = false;
		}
	}

	/** Ping DB connection every `pingIntervalSeconds` seconds to check if it is still alive. */
	private scheduleNextPing() {
		this.pingTimer = setTimeout(
			async () => await this.ping(),
			this.databaseConfig.pingIntervalSeconds * Time.seconds.toMilliseconds,
		);
	}

	private async ping() {
		if (!this.dataSource?.isInitialized) return;
		try {
			await this.dataSource.query('SELECT 1');
			this.connectionState.connected = true;
			return;
		} catch (error) {
			this.connectionState.connected = false;
			this.errorReporter.error(error);
		} finally {
			this.scheduleNextPing();
		}
	}
}
