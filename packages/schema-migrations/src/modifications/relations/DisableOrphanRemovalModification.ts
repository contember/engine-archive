import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater, updateEntity, updateField, updateModel } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { isOwningRelation } from '@contember/schema-utils'
import { updateRelations } from '../utils/diffUtils'
import { builder } from '../builder'

export class DisableOrphanRemovalModificationHandler implements ModificationHandler<DisableOrphanRemovalModificationData> {

	constructor(
		private readonly data: DisableOrphanRemovalModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {}

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName, fieldName } = this.data
		return builder(this.options, it => it.updateRelationOrphanRemoval(entityName, fieldName, false))
	}

	describe() {
		return {
			message: `Disable orphan removal on ${this.data.entityName}.${this.data.fieldName}`,
		}
	}
}

export interface DisableOrphanRemovalModificationData {
	entityName: string
	fieldName: string
}

export const disableOrphanRemovalModification = createModificationType({
	id: 'disableOrphanRemoval',
	handler: DisableOrphanRemovalModificationHandler,
})

export class DisableOrphanRemovalDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				isOwningRelation(originalRelation) &&
				isOwningRelation(updatedRelation) &&
				originalRelation.type === Model.RelationType.OneHasOne &&
				updatedRelation.type === Model.RelationType.OneHasOne &&
				originalRelation.orphanRemoval &&
				!updatedRelation.orphanRemoval
			) {
				return disableOrphanRemovalModification.createModification({
					entityName: updatedEntity.name,
					fieldName: updatedRelation.name,
				})
			}
			return undefined
		})
	}
}
