import { MigrationBuilder } from '@contember/database-migrations'
import { Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import deepEqual from 'fast-deep-equal'
import { createCheck, getConstraintName } from './enumUtils'
import { builder } from '../builder'

export class UpdateEnumModificationHandler implements ModificationHandler<UpdateEnumModificationData> {
	constructor(
		private readonly data: UpdateEnumModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		builder.sql(`
			ALTER DOMAIN "${this.data.enumName}"
			DROP CONSTRAINT ${getConstraintName(this.data.enumName)}`)
		builder.sql(`
			ALTER DOMAIN "${this.data.enumName}"
			ADD CONSTRAINT ${getConstraintName(this.data.enumName)} CHECK (${createCheck(this.data.values)})`)
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(this.options, it => it.updateEnumValues(this.data.enumName, this.data.values))
	}

	describe() {
		const currentValues = this.schema.model.enums[this.data.enumName]
		const missingValues = currentValues.filter(it => !this.data.values.includes(it))
		const failureWarning =
			missingValues.length > 0
				? `Removing values (${missingValues.join(', ')}) from enum, this may fail in runtime`
				: undefined
		return { message: `Update enum ${this.data.enumName}`, failureWarning }
	}
}

export interface UpdateEnumModificationData {
	enumName: string
	values: readonly string[]
}

export const updateEnumModification = createModificationType({
	id: 'updateEnum',
	handler: UpdateEnumModificationHandler,
})

export class UpdateEnumDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return Object.entries(updatedSchema.model.enums)
			.filter(
				([name]) =>
					originalSchema.model.enums[name] &&
					!deepEqual(updatedSchema.model.enums[name], originalSchema.model.enums[name]),
			)
			.map(([enumName, values]) => updateEnumModification.createModification({ enumName, values }))
	}
}
