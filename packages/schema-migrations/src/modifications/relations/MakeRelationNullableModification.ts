import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater, updateEntity, updateField, updateModel } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { getEntity, tryGetColumnName } from '@contember/schema-utils'
import { isIt } from '../../utils/isIt'
import { updateRelations } from '../utils/diffUtils'
import { builder } from '../builder'

export class MakeRelationNullableModificationHandler implements ModificationHandler<MakeRelationNullableModificationData> {
	constructor(
		private readonly data: MakeRelationNullableModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		const entity = getEntity(this.schema.model, this.data.entityName)
		if (entity.view) {
			return
		}
		const columnName = tryGetColumnName(this.schema.model, entity, this.data.fieldName)
		if (!columnName) {
			return
		}
		builder.alterColumn(entity.tableName, columnName, {
			notNull: false,
		})
	}

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName, fieldName } = this.data
		return builder(this.options, it => it.updateRelationNullable(entityName, fieldName, true))
	}

	describe() {
		return {
			message: `Make relation ${this.data.entityName}.${this.data.fieldName} nullable`,
		}
	}

}

export interface MakeRelationNullableModificationData {
	entityName: string
	fieldName: string
}


export const makeRelationNullableModification = createModificationType({
	id: 'makeRelationNullable',
	handler: MakeRelationNullableModificationHandler,
})

export class MakeRelationNullableDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				originalRelation.type === updatedRelation.type &&
				isIt<Model.NullableRelation>(updatedRelation, 'nullable') &&
				isIt<Model.NullableRelation>(originalRelation, 'nullable') &&
				updatedRelation.nullable &&
				!originalRelation.nullable
			) {
				return makeRelationNullableModification.createModification({
					entityName: updatedEntity.name,
					fieldName: updatedRelation.name,
				})
			}
			return undefined
		})
	}
}
