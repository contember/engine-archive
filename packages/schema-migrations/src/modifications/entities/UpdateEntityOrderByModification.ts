import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater, updateEntity, updateModel } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import deepEqual from 'fast-deep-equal'
import { builder } from '../builder'

export class UpdateEntityOrderByModificationHandler implements ModificationHandler<UpdateEntityOrderByModificationData> {

	constructor(
		private readonly data: UpdateEntityOrderByModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) { }

	public createSql(builder: MigrationBuilder): void { }

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName, orderBy } = this.data

		return builder(this.options, it => it.updateEntity(entityName, ({ entity }) => {
			if (orderBy) {
				return {
					...entity,
					orderBy,
				}
			}
			const { orderBy: _, ...rest } = entity
			return rest
		}))
	}

	describe() {
		return { message: `Update order-by of entity ${this.data.entityName}` }
	}
}

export interface UpdateEntityOrderByModificationData {
	entityName: string
	orderBy?: readonly Model.OrderBy[]
}

export const updateEntityOrderByModification = createModificationType({
	id: 'updateEntityOrderBy',
	handler: UpdateEntityOrderByModificationHandler,
})

export class UpdateEntityOrderByDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.values(updatedSchema.model.entities)
			.flatMap(updatedEntity => {
				const origEntity = originalSchema.model.entities[updatedEntity.name]
				if (!origEntity) {
					return []
				}

				if (!deepEqual(updatedEntity.orderBy ?? [], origEntity.orderBy ?? [])) {
					if (updatedEntity.orderBy) {
						return [updateEntityOrderByModification.createModification({
							entityName: updatedEntity.name,
							orderBy: updatedEntity.orderBy,
						})]
					}
					return [updateEntityOrderByModification.createModification({
						entityName: updatedEntity.name,
					})]
				}
				return []
			})

	}
}
