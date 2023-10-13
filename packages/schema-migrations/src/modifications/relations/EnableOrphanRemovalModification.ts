import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { isOwningRelation } from '@contember/schema-utils'
import { updateRelations } from '../utils/diffUtils'
import { builder } from '../builder'

export class EnableOrphanRemovalModificationHandler implements ModificationHandler<EnableOrphanRemovalModificationData> {
	constructor(
		private readonly data: EnableOrphanRemovalModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {}

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName, fieldName } = this.data
		return builder(this.options, it => it.updateRelationOrphanRemoval(entityName, fieldName, true))
	}

	describe() {
		return {
			message: `Enable orphan removal on ${this.data.entityName}.${this.data.fieldName}`,
		}
	}

}

export interface EnableOrphanRemovalModificationData {
	entityName: string
	fieldName: string
}

export const enableOrphanRemovalModification = createModificationType({
	id: 'enableOrphanRemoval',
	handler: EnableOrphanRemovalModificationHandler,
})

export class EnableOrphanRemovalDiffer implements Differ {
	 createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				isOwningRelation(originalRelation) &&
				isOwningRelation(updatedRelation) &&
				originalRelation.type === Model.RelationType.OneHasOne &&
				updatedRelation.type === Model.RelationType.OneHasOne &&
				!originalRelation.orphanRemoval &&
				updatedRelation.orphanRemoval
			) {
				return enableOrphanRemovalModification.createModification({
					entityName: updatedEntity.name,
					fieldName: updatedRelation.name,
				})
			}
			return undefined
		})
	}
}
