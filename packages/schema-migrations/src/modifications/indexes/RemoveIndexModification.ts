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
import deepEqual from 'fast-deep-equal'
import { getIndexColumns } from './utils'
import { wrapIdentifier } from '../../utils/dbHelpers'
import { builder } from '../builder'

export class RemoveIndexModificationHandler implements ModificationHandler<RemoveIndexModificationData>  {
	constructor(
		private readonly data: RemoveIndexModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder, { databaseMetadata, invalidateDatabaseMetadata }: ModificationHandlerCreateSqlOptions): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (entity.view) {
			return
		}
		const fields = this.getFields()

		const columns = getIndexColumns({
			entity,
			fields,
			model: this.schema.model,
		})

		const indexNames = databaseMetadata.getIndexNames({ tableName: entity.tableName, columnNames: columns })

		for (const name of indexNames) {
			builder.sql(`DROP INDEX ${wrapIdentifier(name)}`)
		}
		invalidateDatabaseMetadata()
	}

	public getSchemaUpdater(): SchemaUpdater {
		const fields = this.getFields()
		return builder(this.options, it => it.removeIndex(this.data.entityName, { fields }))
	}

	describe() {
		const fields = this.getFields()
		return { message: `Remove index (${fields.join(', ')}) on entity ${this.data.entityName}` }
	}

	getFields() {
		const entity = this.schema.model.entities[this.data.entityName]
		const fields = 'indexName' in this.data
			? entity.indexes.find(it => it.name === this.data.indexName)?.fields
			: this.data.fields
		if (!fields) {
			throw new Error()
		}
		return fields
	}
}

export const removeIndexModification = createModificationType({
	id: 'removeIndex',
	handler: RemoveIndexModificationHandler,
})


export type RemoveIndexModificationData =
	| {
		entityName: string
		indexName: string
		fields?: never
	}
	| {
		entityName: string
		fields: readonly string[]
		indexName?: never
	}

export class RemoveIndexDiffer implements Differ {

	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.values(originalSchema.model.entities).flatMap(entity =>
			entity.indexes
				.filter(
					it => {
						const updatedEntity = updatedSchema.model.entities[entity.name]
						if (!updatedEntity) {
							return false
						}
						return !updatedEntity.indexes.find(index => deepEqual(index.fields, it.fields))
					},
				)
				.map(index =>
					removeIndexModification.createModification({
						entityName: entity.name,
						fields: index.fields,
					}),
				),
		)
	}
}
