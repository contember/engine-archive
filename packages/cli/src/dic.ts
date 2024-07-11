import { Builder } from '@contember/dic'
import {
	JsLoader,
	JsonLoader,
	MigrationCreator,
	MigrationDescriber,
	MigrationExecutor,
	MigrationFilesManager,
	MigrationParser,
	MigrationsResolver,
	MigrationsStatusResolver,
	ModificationHandlerFactory,
	SchemaDiffer,
	SchemaMigrator,
	SchemaVersionBuilder,
	VERSION_LATEST,
} from '@contember/migrations-client'
import { JsCodeRunner } from './lib/js/JsCodeRunner'
import { EsBuildBuilder } from './lib/js/EsBuildBuilder'
import { EvalExecutor } from './lib/js/EvalExecutor'
import { AdminDeployer } from './lib/admin/AdminDeployer'
import { RemoteProjectResolver } from './lib/project/RemoteProjectResolver'
import { CliEnv } from './lib/env'
import { AdminClient } from './lib/admin/AdminClient'
import { FileSystem } from './lib/fs/FileSystem'
import { WorkspaceResolver } from './lib/workspace/WorkspaceResolver'
import { YamlHandler } from './lib/fs/YamlHandler'
import {
	DeployCommand,
	MigrationAmendCommand,
	MigrationBlankCommand,
	MigrationDescribeCommand,
	MigrationDiffCommand,
	MigrationExecuteCommand,
	MigrationRebaseCommand,
	MigrationStatusCommand,
	ProjectGenerateDocumentationCommand,
	ProjectPrintSchemaCommand,
	ProjectValidateCommand,
	VersionCommand,
	WorkspaceUpdateApiCommand,
} from './commands'
import { MigrationExecutionFacade } from './lib/migrations/MigrationExecutionFacade'
import { MigrationPrinter } from './lib/migrations/MigrationPrinter'
import { MigrationsStatusFacade } from './lib/migrations/MigrationsStatusFacade'
import { SchemaLoader } from './lib/schema/SchemaLoader'
import { MigrationsValidator } from './lib/migrations/MigrationsValidator'
import { MigrationRebaseFacade } from './lib/migrations/MigrationRebaseFacade'
import { DataTransferClient } from './lib/transfer/DataTransferClient'
import { ExportCommand, ImportCommand, TransferCommand } from './commands/transfer'
import {
	Application,
	CommandFactoryList,
	CommandManager,
	CommandRunner,
	Npm,
	PackageWorkspaceResolver,
	Pnpm,
	Yarn,
	YarnClassic,
} from '@contember/cli-common'
import { VersionChecker } from './lib/VersionChecker'
import { DockerComposeManager } from './lib/fs/DockerComposeManager'
import { RemoteProjectProvider } from './lib/project/RemoteProjectProvider'
import { SystemClientProvider } from './lib/SystemClientProvider'
import { TenantClientProvider } from './lib/TenantClientProvider'

const jsSample = `
export const query = \`\`
export const variables = {}

// or multiple queries
// export const queries = []

// or a factory
// export default async () => ({ queries: [] })
`

export const createContainer = ({ dir, env, version }: {
	dir: string
	env: CliEnv
	version: string
}) => {
	return new Builder({})
		.addService('env', () =>
			env)
		.addService('dir', () =>
			dir)
		.addService('version', () =>
			version)
		.addService('fs', () =>
			new FileSystem())
		.addService('yamlHandler', ({ fs }) =>
			new YamlHandler(fs))
		.addService('jsExecutor', () =>
			new EvalExecutor())
		.addService('jsBuilder', () =>
			new EsBuildBuilder())
		.addService('jsCodeRunner', ({ jsExecutor, jsBuilder }) =>
			new JsCodeRunner(jsBuilder, jsExecutor))

		.addService('workspaceResolver', ({ yamlHandler }) =>
			new WorkspaceResolver(yamlHandler))
		.addService('workspace', ({ workspaceResolver, dir }) =>
			workspaceResolver.resolve(dir))

		.addService('remoteProjectResolver', ({ env }) =>
			new RemoteProjectResolver(env))
		.addService('remoteProjectProvider', ({ remoteProjectResolver }) => {
			const provider = new RemoteProjectProvider()
			const remoteProject = remoteProjectResolver.resolve()
			if (remoteProject) {
				provider.setRemoteProject(remoteProject)
			}
			return provider
		})
		.addService('systemClientProvider', ({ remoteProjectProvider }) =>
			new SystemClientProvider(remoteProjectProvider))
		.addService('tenantClientProvider', ({ remoteProjectProvider }) =>
			new TenantClientProvider(remoteProjectProvider))
		.addService('adminClient', ({ remoteProjectProvider }) =>
			new AdminClient(remoteProjectProvider))
		.addService('migrationFilesManager', ({ jsCodeRunner, dir }) => {

			return new MigrationFilesManager(dir, {
				json: new JsonLoader(new MigrationParser()),
				ts: new JsLoader(new MigrationParser(), jsCodeRunner.run),
				js: new JsLoader(new MigrationParser(), jsCodeRunner.run),
			})
		})
		.addService('packageWorkspaceResolver', ({ dir, fs }) => {
			const commandRunner = new CommandRunner()
			return new PackageWorkspaceResolver(dir, fs, [
				new Yarn(fs, commandRunner),
				new YarnClassic(fs, commandRunner),
				new Pnpm(fs, commandRunner),
				new Npm(fs, commandRunner),
			])
		})
		.addService('dockerComposeManager', ({ dir, env, fs, yamlHandler }) =>
			new DockerComposeManager(dir, env.dockerComposeFile, fs, yamlHandler))
		.addService('modificationHandlerFactory', () =>
			new ModificationHandlerFactory(ModificationHandlerFactory.defaultFactoryMap))
		.addService('schemaMigrator', ({ modificationHandlerFactory }) =>
			new SchemaMigrator(modificationHandlerFactory))
		.addService('migrationsResolver', ({ migrationFilesManager }) =>
			new MigrationsResolver(migrationFilesManager))
		.addService('schemaVersionBuilder', ({ migrationsResolver, schemaMigrator }) =>
			new SchemaVersionBuilder(migrationsResolver, schemaMigrator))
		.addService('schemaDiffer', ({ schemaMigrator }) =>
			new SchemaDiffer(schemaMigrator))
		.addService('migrationCreator', ({ migrationFilesManager, schemaDiffer }) =>
			new MigrationCreator(migrationFilesManager, schemaDiffer, {
				json: JSON.stringify({ formatVersion: VERSION_LATEST, modifications: [] }, undefined, '\t') + '\n',
				ts: jsSample,
				js: jsSample,
			}))
		.addService('migrationDescriber', ({ modificationHandlerFactory }) =>
			new MigrationDescriber(modificationHandlerFactory))
		.addService('migrationPrinter', ({ migrationDescriber }) =>
			new MigrationPrinter(migrationDescriber))
		.addService('migrationsExecutor', () =>
			new MigrationExecutor())
		.addService('migrationsStatusResolver', () =>
			new MigrationsStatusResolver())
		.addService('migrationsStatusFacade', ({ systemClientProvider, migrationsResolver, migrationsStatusResolver }) =>
			new MigrationsStatusFacade(systemClientProvider, migrationsResolver, migrationsStatusResolver))
		.addService('migrationExecutionFacade', ({ systemClientProvider, tenantClientProvider, remoteProjectProvider, schemaVersionBuilder, migrationPrinter, migrationsExecutor, migrationsStatusFacade }) =>
			new MigrationExecutionFacade(systemClientProvider, tenantClientProvider, remoteProjectProvider, schemaVersionBuilder, migrationPrinter, migrationsExecutor, migrationsStatusFacade))
		.addService('migrationsValidator', ({ migrationDescriber, schemaMigrator }) =>
			new MigrationsValidator(migrationDescriber, schemaMigrator))
		.addService('migrationRebaseFacade', ({ schemaVersionBuilder, migrationsValidator, systemClientProvider, migrationFilesManager }) =>
			new MigrationRebaseFacade(schemaVersionBuilder, migrationsValidator, systemClientProvider, migrationFilesManager))
		.addService('schemaLoader', ({ workspace, jsCodeRunner }) =>
			new SchemaLoader(workspace, jsCodeRunner))

		.addService('adminDeployer', ({ remoteProjectProvider, adminClient, fs }) =>
			new AdminDeployer(remoteProjectProvider, adminClient, fs))
		.addService('dataTransferClient', () =>
			new DataTransferClient())


		.addService('deployCommand', ({ adminDeployer, migrationExecutionFacade, fs, remoteProjectProvider, remoteProjectResolver, workspace }) =>
		 	new DeployCommand(adminDeployer, migrationExecutionFacade, fs, remoteProjectProvider, remoteProjectResolver, workspace))
		.addService('migrationAmendCommand', ({ migrationsResolver, systemClientProvider, migrationsStatusFacade, schemaLoader, schemaVersionBuilder, migrationCreator, migrationsValidator, migrationPrinter, schemaMigrator }) =>
			new MigrationAmendCommand(migrationsResolver, systemClientProvider, migrationsStatusFacade, schemaLoader, schemaVersionBuilder, migrationCreator, migrationsValidator, migrationPrinter, schemaMigrator))
		.addService('migrationBlankCommand', ({ migrationCreator }) =>
			new MigrationBlankCommand(migrationCreator))
		.addService('migrationDescribeCommand', ({ migrationPrinter, schemaVersionBuilder, migrationsResolver }) =>
			new MigrationDescribeCommand(migrationPrinter, schemaVersionBuilder, migrationsResolver))
		.addService('migrationDiffCommand', ({ schemaLoader, schemaVersionBuilder, migrationCreator, migrationPrinter, migrationExecutionFacade }) =>
			new MigrationDiffCommand(schemaLoader, schemaVersionBuilder, migrationCreator, migrationPrinter, migrationExecutionFacade))
		.addService('migrationExecuteCommand', ({ migrationExecutionFacade }) =>
			new MigrationExecuteCommand(migrationExecutionFacade))
		.addService('migrationRebaseCommand', ({ migrationsResolver, migrationRebaseFacade }) =>
			new MigrationRebaseCommand(migrationsResolver, migrationRebaseFacade))
		.addService('migrationStatusCommand', ({ migrationsStatusFacade, migrationFilesManager, systemClientProvider, migrationPrinter }) =>
			new MigrationStatusCommand(migrationsStatusFacade, migrationFilesManager, systemClientProvider, migrationPrinter))
		.addService('versionCommand', ({ version }) =>
			new VersionCommand(version))
		.addService('projectGenerateDocumentationCommand', ({ schemaLoader }) =>
			new ProjectGenerateDocumentationCommand(schemaLoader))
		.addService('projectPrintSchemaCommand', ({ schemaLoader, schemaVersionBuilder }) =>
			new ProjectPrintSchemaCommand(schemaLoader, schemaVersionBuilder))
		.addService('projectValidateCommand', ({ schemaLoader, migrationsValidator, migrationsResolver, schemaDiffer, schemaVersionBuilder }) =>
			new ProjectValidateCommand(schemaLoader, migrationsValidator, migrationsResolver, schemaDiffer, schemaVersionBuilder))
		.addService('exportCommand', ({ dataTransferClient, remoteProjectResolver }) =>
			new ExportCommand(remoteProjectResolver, dataTransferClient))
		.addService('importCommand', ({ dataTransferClient, remoteProjectResolver }) =>
			new ImportCommand(remoteProjectResolver, dataTransferClient))
		.addService('transferCommand', ({ dataTransferClient, remoteProjectResolver }) =>
			new TransferCommand(remoteProjectResolver, dataTransferClient))
		.addService('workspaceUpdateCommand', ({ packageWorkspaceResolver, dockerComposeManager }) =>
			new WorkspaceUpdateApiCommand(packageWorkspaceResolver, dockerComposeManager))
		.addService('commandList', dic => {
			const commands: CommandFactoryList = {
				['deploy']: () => dic.deployCommand,
				['version']: () => dic.versionCommand,
				['data:export']: () => dic.exportCommand,
				['data:import']: () => dic.importCommand,
				['data:transfer']: () => dic.transferCommand,
				['migrations:diff']: () => dic.migrationDiffCommand,
				['migrations:amend']: () => dic.migrationAmendCommand,
				['migrations:blank']: () => dic.migrationBlankCommand,
				['migrations:describe']: () => dic.migrationDescribeCommand,
				['migrations:execute']: () => dic.migrationExecuteCommand,
				['migrations:rebase']: () => dic.migrationRebaseCommand,
				['migrations:status']: () => dic.migrationStatusCommand,
				['workspace:update:api']: () => dic.workspaceUpdateCommand,
				['project:validate']: () => dic.projectValidateCommand,
				['project:print-schema']: () => dic.projectPrintSchemaCommand,
				['project:generate-doc']: () => dic.projectGenerateDocumentationCommand,
			}
			return commands
		})
		.addService('commandManager', ({ commandList }) =>
			new CommandManager(commandList))

		.addService('versionChecker', ({ version, dir, packageWorkspaceResolver, dockerComposeManager }) =>
			new VersionChecker(version, dir, packageWorkspaceResolver, dockerComposeManager))
		.addService('application', ({ commandManager, versionChecker }) => {
			const app = new Application(
				commandManager,
				`Contember CLI version ${version}`,
				{
					beforeRun: async ({ name }) => {
						if (!process.env.CONTEMBER_SKIP_VERSION_CHECK && !['deploy', 'version', 'data:export', 'data:import', 'data:transfer'].includes(name)) {
							await versionChecker.checkVersions()
						}
					},
				},
			)
			return app
		})
		.build()
}
