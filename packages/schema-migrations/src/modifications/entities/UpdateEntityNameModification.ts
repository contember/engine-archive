import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import {
	createModificationType,
	ModificationHandler,
	ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { NoopModification } from '../NoopModification'
import { updateEntityTableNameModification } from './UpdateEntityTableNameModification'
import { builder } from '../builder'

export class UpdateEntityNameModificationHandler implements ModificationHandler<UpdateEntityNameModificationData> {
	private subModification: ModificationHandler<any>

	constructor(
		private readonly data: UpdateEntityNameModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {
		this.subModification = data.tableName
			? updateEntityTableNameModification.createHandler(
				{ entityName: data.entityName, tableName: data.tableName },
				schema,
				this.options,
			  )
			: new NoopModification()
	}

	public createSql(builder: MigrationBuilder, options: ModificationHandlerCreateSqlOptions): void {
		this.subModification.createSql(builder, options)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it
			.updateSchema(this.subModification.getSchemaUpdater())
			.updateEntityName(this.data.entityName, this.data.newEntityName))
	}

	describe() {
		return { message: `Change entity name from ${this.data.entityName} to ${this.data.newEntityName}` }
	}
}

export interface UpdateEntityNameModificationData {
	entityName: string
	newEntityName: string
	tableName?: string
}

export const updateEntityNameModification = createModificationType({
	id: 'updateEntityName',
	handler: UpdateEntityNameModificationHandler,
})
