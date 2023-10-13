import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import {
	createModificationType,
	Differ,
	ModificationHandler,
	ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { isIt } from '../../utils/isIt'
import { updateRelations } from '../utils/diffUtils'
import { acceptRelationTypeVisitor } from '@contember/schema-utils'
import { addForeignKeyConstraint } from './helpers'
import { builder } from '../builder'

export class UpdateRelationOnDeleteModificationHandler implements ModificationHandler<UpdateRelationOnDeleteModificationData> {
	constructor(
		private readonly data: UpdateRelationOnDeleteModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder, { databaseMetadata, invalidateDatabaseMetadata }: ModificationHandlerCreateSqlOptions): void {
		const updatedSchema = this.getSchemaUpdater()({ schema: this.schema })
		const entity = updatedSchema.model.entities[this.data.entityName]
		if (entity.view) {
			return
		}

		acceptRelationTypeVisitor(updatedSchema.model, entity, this.data.fieldName, {
			visitManyHasOne: ({ entity, relation, targetEntity }) => {
				addForeignKeyConstraint({ builder, entity, targetEntity, relation, recreate: true, databaseMetadata, invalidateDatabaseMetadata })
			},
			visitOneHasOneOwning: ({ entity, relation, targetEntity }) => {
				addForeignKeyConstraint({ builder, entity, targetEntity, relation, recreate: true, databaseMetadata, invalidateDatabaseMetadata })
			},
			visitOneHasMany: () => {},
			visitOneHasOneInverse: () => {},
			visitManyHasManyOwning: () => {},
			visitManyHasManyInverse: () => {},
		})
	}

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName, fieldName, onDelete } = this.data
		return builder(this.options, it => it.updateRelationOnDelete(entityName, fieldName, onDelete))
	}

	describe() {
		return { message: `Change on-delete policy of relation ${this.data.entityName}.${this.data.fieldName}` }
	}
}

export interface UpdateRelationOnDeleteModificationData {
	entityName: string
	fieldName: string
	onDelete: Model.OnDelete
}

export const updateRelationOnDeleteModification = createModificationType({
	id: 'updateRelationOnDelete',
	handler: UpdateRelationOnDeleteModificationHandler,
})

export class UpdateRelationOnDeleteDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				originalRelation.type === updatedRelation.type &&
				isIt<Model.JoiningColumnRelation>(updatedRelation, 'joiningColumn') &&
				isIt<Model.JoiningColumnRelation>(originalRelation, 'joiningColumn') &&
				updatedRelation.joiningColumn.onDelete !== originalRelation.joiningColumn.onDelete
			) {
				return updateRelationOnDeleteModification.createModification({
					entityName: updatedEntity.name,
					fieldName: updatedRelation.name,
					onDelete: updatedRelation.joiningColumn.onDelete,
				})
			}
			return undefined
		})
	}
}
