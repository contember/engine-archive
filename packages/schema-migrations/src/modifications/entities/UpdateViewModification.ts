import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { createModificationType, ModificationHandler } from '../ModificationHandler'
import { SchemaUpdater, updateEntity, updateModel } from '../utils/schemaUpdateUtils'

export class UpdateViewModificationHandler implements ModificationHandler<UpdateViewModificationData> {
	constructor(private readonly data: UpdateViewModificationData, private readonly schema: Schema) {}

	public createSql(builder: MigrationBuilder): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (!entity.migrations.enabled) {
			return
		}
		builder.createView(
			entity.tableName,
			{
				replace: true,
			},
			this.data.view.sql,
		)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return updateModel(
			updateEntity(this.data.entityName, ({ entity }) => ({
				...entity,
				view: this.data.view,
			})),
		)
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
