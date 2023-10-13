import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { Migration } from '../../Migration'
import { PossibleEntityShapeInMigrations } from '../../utils/PartialEntity.js'
import { builder } from '../builder'

export class CreateViewModificationHandler implements ModificationHandler<CreateViewModificationData> {
	constructor(
		private readonly data: CreateViewModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		const entity = this.data.entity
		if (!entity.view) {
			throw new Error()
		}
		builder.createView(entity.tableName, {}, entity.view.sql)
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
		return { message: `Add view ${this.data.entity.name}` }
	}
}

export const createViewModification = createModificationType({
	id: 'createView',
	handler: CreateViewModificationHandler,
})

export class CreateViewDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		const newViews = Object.values(updatedSchema.model.entities)
			.filter(it => !originalSchema.model.entities[it.name])
			.filter(it => !!it.view)
		const created = new Set<string>()
		const modifications: Migration.Modification[] = []
		const cascadeCreate = (entity: Model.Entity) => {
			if (originalSchema.model.entities[entity.name] || created.has(entity.name)) {
				return
			}
			created.add(entity.name)
			for (const dependency of entity.view?.dependencies ?? []) {
				cascadeCreate(updatedSchema.model.entities[dependency])
			}
			modifications.push(createViewModification.createModification({
				entity: entity,
			}))
		}
		for (const view of newViews) {
			cascadeCreate(view)
		}
		return modifications
	}
}

export interface CreateViewModificationData {
	entity: PossibleEntityShapeInMigrations
}
