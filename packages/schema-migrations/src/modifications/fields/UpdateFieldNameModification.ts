import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import {
	createModificationType,
	ModificationHandler,
	ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { updateColumnNameModification } from '../columns'
import { NoopModification } from '../NoopModification'
import { builder } from '../builder'

export class UpdateFieldNameModificationHandler implements ModificationHandler<UpdateFieldNameModificationData> {
	private renameColumnSubModification: ModificationHandler<any> = new NoopModification()

	constructor(
		private readonly data: UpdateFieldNameModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {
		if (this.data.columnName) {
			this.renameColumnSubModification = updateColumnNameModification.createHandler({
				entityName: this.data.entityName,
				columnName: this.data.columnName,
				fieldName: this.data.fieldName,
			}, this.schema, this.options)
		}
	}

	public createSql(builder: MigrationBuilder, options: ModificationHandlerCreateSqlOptions): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (entity.view) {
			return
		}
		this.renameColumnSubModification.createSql(builder, options)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it
			.updateSchema(this.renameColumnSubModification.getSchemaUpdater())
			.updateFieldName(this.data.entityName, this.data.fieldName, this.data.newFieldName))
	}

	describe() {
		return { message: `Change field name ${this.data.entityName}.${this.data.fieldName} to ${this.data.newFieldName}` }
	}
}

export interface UpdateFieldNameModificationData {
	entityName: string
	fieldName: string
	newFieldName: string
	columnName?: string
}

export const updateFieldNameModification = createModificationType({
	id: 'updateFieldName',
	handler: UpdateFieldNameModificationHandler,
})
