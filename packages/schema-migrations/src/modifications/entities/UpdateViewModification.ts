import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { createModificationType, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { builder } from '../builder'

export class UpdateViewModificationHandler implements ModificationHandler<UpdateViewModificationData> {
	constructor(
		private readonly data: UpdateViewModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		const entity = this.schema.model.entities[this.data.entityName]
		builder.createView(
			entity.tableName,
			{
				replace: true,
			},
			this.data.view.sql,
		)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it.updateEntity(this.data.entityName, ({ entity }) => ({
			...entity,
			view: this.data.view,
		})))
	}

	describe() {
		return { message: `Update SQL definition of a view` }
	}

}

export interface UpdateViewModificationData {
	entityName: string
	view: Model.View
}

export const updateViewModification = createModificationType({
	id: 'updateView',
	handler: UpdateViewModificationHandler,
})
