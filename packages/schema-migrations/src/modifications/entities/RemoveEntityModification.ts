import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import {
	createModificationType,
	Differ,
	ModificationHandler,
	ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { VERSION_REMOVE_REFERENCING_RELATIONS } from '../ModificationVersions'
import { isRelation } from '@contember/schema-utils'
import { removeFieldModification } from '../fields'
import { builder } from '../builder'

export class RemoveEntityModificationHandler implements ModificationHandler<RemoveEntityModificationData> {
	constructor(
		private readonly data: RemoveEntityModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder, options: ModificationHandlerCreateSqlOptions): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (entity.view) {
			builder.dropView(entity.tableName)
			return
		}
		if (this.options.formatVersion >= VERSION_REMOVE_REFERENCING_RELATIONS) {
			this.getFieldsToRemove(this.schema).forEach(([entityName, fieldName]) => {
				const removeFieldHandler = removeFieldModification.createHandler({ entityName, fieldName }, this.schema, this.options)
				removeFieldHandler.createSql(builder, options)
			})
		}
		builder.dropTable(entity.tableName)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, builder => builder.removeEntity(this.data.entityName))
	}

	private getFieldsToRemove(schema: Schema): [entity: string, field: string][] {
		return Object.values(schema.model.entities).flatMap(entity =>
			Object.values(entity.fields)
				.filter(field => isRelation(field) && field.target === this.data.entityName)
				.map((field): [string, string] => [entity.name, field.name]),
		)
	}

	describe() {
		return { message: `Remove entity ${this.data.entityName}`, isDestructive: true }
	}

}

export interface RemoveEntityModificationData {
	entityName: string
}

export const removeEntityModification = createModificationType({
	id: 'removeEntity',
	handler: RemoveEntityModificationHandler,
})

export class RemoveEntityDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.keys(originalSchema.model.entities)
			.filter(name => !updatedSchema.model.entities[name])
			.map(entityName => removeEntityModification.createModification({ entityName }))
	}
}
