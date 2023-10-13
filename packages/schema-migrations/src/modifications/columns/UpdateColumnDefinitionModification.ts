import { escapeValue, MigrationBuilder } from '@contember/database-migrations'
import { JSONValue, Model, Schema } from '@contember/schema'
import { SchemaUpdater } from '../../schema-builder/schemaUpdateUtils'
import { createModificationType, Differ, ModificationHandler, ModificationHandlerOptions } from '../ModificationHandler'
import deepEqual from 'fast-deep-equal'
import { updateColumns } from '../utils/diffUtils'
import { wrapIdentifier } from '../../utils/dbHelpers'
import { getColumnSqlType } from '../utils/columnUtils'
import { fillSeed } from './columnUtils'
import { builder } from '../builder'
import { ColumnDefinitionAlter } from '../../schema-builder/SchemaBuilder'

export class UpdateColumnDefinitionModificationHandler implements ModificationHandler<UpdateColumnDefinitionModificationData>  {
	constructor(
		private readonly data: UpdateColumnDefinitionModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {}

	public createSql(builder: MigrationBuilder): void {
		const entity = this.schema.model.entities[this.data.entityName]
		if (entity.view) {
			return
		}
		const oldColumn = entity.fields[this.data.fieldName] as Model.AnyColumn
		const newColumn = this.data.definition

		const hasNewSequence = !oldColumn.sequence && newColumn.sequence
		const hasNewType = newColumn.columnType !== oldColumn.columnType
		const columnType = getColumnSqlType(newColumn)

		const usingCast = `${wrapIdentifier(oldColumn.columnName)}::${columnType}`

		const hasSeed = this.data.fillValue !== undefined || this.data.copyValue !== undefined

		builder.alterColumn(entity.tableName, oldColumn.columnName, {
			type: hasNewSequence || hasNewType ? columnType : undefined,
			notNull: oldColumn.nullable !== newColumn.nullable && (!hasSeed || newColumn.nullable) ? !newColumn.nullable : undefined,
			using: hasNewSequence
				? `COALESCE(${usingCast}, nextval(PG_GET_SERIAL_SEQUENCE(${escapeValue(entity.tableName)}, ${escapeValue(oldColumn.columnName)})))`
				: hasNewType
					? usingCast
					: undefined,
			sequenceGenerated: oldColumn.sequence && !newColumn.sequence ? false : (!oldColumn.sequence ? newColumn.sequence : undefined),
		})

		if (hasSeed) {
			fillSeed({
				builder,
				type: 'updating',
				model: this.schema.model,
				entity,
				columnName: oldColumn.columnName,
				nullable: newColumn.nullable,
				columnType,
				copyValue: this.data.copyValue,
				fillValue: this.data.fillValue,
			})
		}

		const seqAlter = []
		if (oldColumn.sequence && newColumn.sequence) {
			if (oldColumn.sequence.precedence !== newColumn.sequence.precedence) {
				seqAlter.push(`SET GENERATED ${newColumn.sequence.precedence}`)
			}
			if (oldColumn.sequence.start !== newColumn.sequence.start && typeof newColumn.sequence.start == 'number') {
				seqAlter.push(`SET START WITH ${newColumn.sequence.start}`)
			}
			if (newColumn.sequence.restart) {
				seqAlter.push('RESTART')
			}
		}
		if (seqAlter.length > 0) {
			builder.sql(`ALTER TABLE ${wrapIdentifier(entity.tableName)} ALTER ${wrapIdentifier(oldColumn.columnName)} ${seqAlter.join(' ')}`)
		}
	}

	public getSchemaUpdater(): SchemaUpdater {
		return builder(
			this.options,
			it => it.updateColumnDefinition(this.data.entityName, this.data.fieldName, this.data.definition),
		)
	}

	describe() {
		const current = this.schema.model.entities[this.data.entityName].fields[this.data.fieldName] as Model.AnyColumn
		const changingToNotNull = current.nullable && !this.data.definition.nullable
		const failureWarning = changingToNotNull ? 'Changing to not-null may fail in runtime.' : undefined

		return {
			message: `Update column definition of field ${this.data.entityName}.${this.data.fieldName}`,
			failureWarning,
		}
	}
}


export interface UpdateColumnDefinitionModificationData {
	entityName: string
	fieldName: string
	definition: ColumnDefinitionAlter
	fillValue?: JSONValue
	copyValue?: string
}

export const updateColumnDefinitionModification = createModificationType({
	id: 'updateColumnDefinition',
	handler: UpdateColumnDefinitionModificationHandler,
})

export class UpdateColumnDefinitionDiffer implements Differ<UpdateColumnDefinitionModificationData> {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateColumns(originalSchema, updatedSchema, ({ originalColumn, updatedColumn, updatedEntity }) => {
			const {
				name: {},
				columnName: {},
				...updatedDefinition
			} = updatedColumn
			const {
				name: {},
				columnName: {},
				...originalDefinition
			} = originalColumn
			if (deepEqual(updatedDefinition, originalDefinition)) {
				return undefined
			}

			return updateColumnDefinitionModification.createModification({
				entityName: updatedEntity.name,
				fieldName: updatedColumn.name,
				definition: updatedDefinition,
			})
		})
	}
}
