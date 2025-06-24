import type { ICredentialType, INodeProperties } from 'n8n-workflow';

import { sshTunnelProperties } from '@utils/sshTunnel.properties';

export class Postgres implements ICredentialType {
	name = 'postgres';

	displayName = 'Postgres';

	documentationUrl = 'postgres';

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication Type',
			name: 'authenticationType',
			type: 'options',
			options: [
				{
					name: 'Username & Password',
					value: 'password',
				},
				{
					name: 'Azure Managed Identity',
					value: 'azure_managed_identity',
				},
			],
			default: 'password',
		},
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: 'localhost',
		},
		{
			displayName: 'Database',
			name: 'database',
			type: 'string',
			default: 'postgres',
		},
		{
			displayName: 'User',
			name: 'user',
			type: 'string',
			displayOptions: {
				show: {
					authenticationType: ['password'],
				},
			},
			default: 'postgres',
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			displayOptions: {
				show: {
					authenticationType: ['password'],
				},
			},
			typeOptions: {
				password: true,
			},
			default: '',
		},
		{
			displayName: 'Azure Tenant ID',
			name: 'azureTenantId',
			type: 'string',
			displayOptions: {
				show: {
					authenticationType: ['azure_managed_identity'],
				},
			},
			default: '',
			description:
				'Required for Service Principal authentication. Leave empty for Managed Identity.',
		},
		{
			displayName: 'Azure Client ID',
			name: 'azureClientId',
			type: 'string',
			displayOptions: {
				show: {
					authenticationType: ['azure_managed_identity'],
				},
			},
			default: '',
			description:
				'Required for Service Principal or User-assigned Managed Identity. Leave empty for System-assigned Managed Identity.',
		},
		{
			displayName: 'Azure Client Secret',
			name: 'azureClientSecret',
			type: 'string',
			displayOptions: {
				show: {
					authenticationType: ['azure_managed_identity'],
				},
			},
			typeOptions: {
				password: true,
			},
			default: '',
			description:
				'Required only for Service Principal authentication. Leave empty for Managed Identity.',
		},
		{
			displayName: 'Token Refresh Margin (seconds)',
			name: 'tokenRefreshMargin',
			type: 'number',
			displayOptions: {
				show: {
					authenticationType: ['azure_managed_identity'],
				},
			},
			default: 300,
			description: 'How many seconds before token expiry to refresh the token',
		},
		{
			displayName: 'Maximum Number of Connections',
			name: 'maxConnections',
			type: 'number',
			default: 100,
			description:
				'Make sure this value times the number of workers you have is lower than the maximum number of connections your postgres instance allows.',
		},
		{
			displayName: 'Ignore SSL Issues (Insecure)',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation is not possible',
		},
		{
			displayName: 'SSL',
			name: 'ssl',
			type: 'options',
			displayOptions: {
				show: {
					allowUnauthorizedCerts: [false],
				},
			},
			options: [
				{
					name: 'Allow',
					value: 'allow',
				},
				{
					name: 'Disable',
					value: 'disable',
				},
				{
					name: 'Require',
					value: 'require',
				},
			],
			default: 'disable',
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 5432,
		},
		...sshTunnelProperties,
	];
}
