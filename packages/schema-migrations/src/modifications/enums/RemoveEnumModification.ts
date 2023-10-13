import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { builder } from '../builder'

export class RemoveEnumModificationHandler implements ModificationHandler<RemoveEnumModificationData> {
	constructor(
		private readonly data: RemoveEnumModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		builder.dropDomain(this.data.enumName)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it.removeEnum(this.data.enumName))
	}

	describe() {
		return { message: `Remove ${this.data.enumName}` }
	}
}

export interface RemoveEnumModificationData {
	enumName: string
}

export const removeEnumModification = createModificationType({
	id: 'removeEnum',
	handler: RemoveEnumModificationHandler,
})

export class RemoveEnumDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.entries(originalSchema.model.enums)
			.filter(([name]) => !updatedSchema.model.enums[name])
			.map(([enumName, values]) => removeEnumModification.createModification({ enumName }))
	}
}
