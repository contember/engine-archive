import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import { createCheck, getConstraintName } from './enumUtils'
import { builder } from '../builder'

export class CreateEnumModificationHandler implements ModificationHandler<CreateEnumModificationData> {
	constructor(
		private readonly data: CreateEnumModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		builder.createDomain(this.data.enumName, 'text', {
			check: createCheck(this.data.values),
			constraintName: getConstraintName(this.data.enumName),
		})
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it.addEnum(this.data))
	}

	describe() {
		return { message: `Add enum ${this.data.enumName}` }
	}
}

export interface CreateEnumModificationData {
	enumName: string
	values: readonly string[]
}

export const createEnumModification = createModificationType({
	id: 'createEnum',
	handler: CreateEnumModificationHandler,
})

export class CreateEnumDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.entries(updatedSchema.model.enums)
			.filter(([name]) => !originalSchema.model.enums[name])
			.map(([enumName, values]) => createEnumModification.createModification({
				enumName,
				values,
			}))
	}
}
