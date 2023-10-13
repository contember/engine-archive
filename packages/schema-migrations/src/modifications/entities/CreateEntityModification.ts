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
import { createEventTrigger, createEventTrxTrigger } from '../utils/sqlUpdateUtils'
import { PossibleEntityShapeInMigrations } from '../../utils/PartialEntity.js'
import { getColumnSqlType } from '../utils/columnUtils'
import { builder } from '../builder'

export class CreateEntityModificationHandler implements ModificationHandler<CreateEntityModificationData> {
	constructor(
		private readonly data: CreateEntityModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder, { systemSchema }: ModificationHandlerCreateSqlOptions): void {
		const entity = this.data.entity
		if (entity.view) {
			// BC
			builder.createView(entity.tableName, {}, entity.view.sql)
			return
		}
		const primaryColumn = entity.fields[entity.primary] as Model.AnyColumn

		builder.createTable(entity.tableName, {
			[primaryColumn.name]: {
				primaryKey: true,
				type: getColumnSqlType(primaryColumn),
				notNull: true,
				sequenceGenerated: primaryColumn.sequence,
			},
		})

		if  (entity.eventLog?.enabled !== false) {
			createEventTrigger(builder, systemSchema, entity.tableName, [entity.primaryColumn])
			createEventTrxTrigger(builder, systemSchema, entity.tableName)
		}
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, builder => builder.addEntity({
			eventLog: { enabled: true },
			...this.data.entity,
			unique: Object.values(this.data.entity.unique),
			indexes: Object.values(this.data.entity.indexes ?? []),
		}))
	}


	describe() {
		return { message: `Add entity ${this.data.entity.name}` }
	}

}

export const createEntityModification = createModificationType({
	id: 'createEntity',
	handler: CreateEntityModificationHandler,
})

export class CreateEntityDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.values(updatedSchema.model.entities)
			.filter(it => !originalSchema.model.entities[it.name])
			.filter(it => !it.view)
			.map(entity =>
				createEntityModification.createModification({
					entity: {
						...entity,
						fields: {
							[entity.primary]: entity.fields[entity.primary],
						},
						unique: [],
					},
				}),
			)
	}
}

export interface CreateEntityModificationData {
	entity: PossibleEntityShapeInMigrations
}
