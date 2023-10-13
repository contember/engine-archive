import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import { addField, SchemaUpdater, updateEntity, updateModel, updateSchema } from '../../schema-builder/schemaUpdateUtils'
import {
	createModificationType,
	Differ,
	ModificationHandler, ModificationHandlerCreateSqlOptions,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { isInverseRelation, isOwningRelation } from '@contember/schema-utils'
import { updateRelations } from '../utils/diffUtils'
import { createJunctionTableSql } from '../utils/createJunctionTable'
import { wrapIdentifier } from '../../utils/dbHelpers'
import { normalizeManyHasManyRelation, PartialManyHasManyRelation } from './normalization'
import { updateFieldNameModification } from '../fields'

export class ConvertOneHasManyToManyHasManyRelationModificationHandler implements ModificationHandler<ConvertOneHasManyToManyHasManyRelationModificationData> {
	private subModification: ModificationHandler<any>

	constructor(
		private readonly data: ConvertOneHasManyToManyHasManyRelationModificationData,
		private readonly schema: Schema,
		private readonly options: ModificationHandlerOptions,
	) {
		this.subModification = updateFieldNameModification.createHandler(
			{
				entityName: this.data.entityName,
				fieldName: this.data.fieldName,
				newFieldName: this.data.owningSide.name,
			},
			schema,
			this.options,
		)
	}

	public createSql(builder: MigrationBuilder, { systemSchema }: ModificationHandlerCreateSqlOptions): void {
		const targetEntity = this.schema.model.entities[this.data.owningSide.target]
		const { relation: oldRelation } = this.getRelation()
		const entity = this.schema.model.entities[this.data.entityName]

		createJunctionTableSql(builder, systemSchema, this.schema, entity, targetEntity, normalizeManyHasManyRelation(this.data.owningSide))
		const joiningTable = this.data.owningSide.joiningTable
		builder.sql(`
			INSERT INTO ${wrapIdentifier(joiningTable.tableName)} (
				${wrapIdentifier(joiningTable.joiningColumn.columnName)},
				${wrapIdentifier(joiningTable.inverseJoiningColumn.columnName)}
				)
			SELECT ${wrapIdentifier(entity.primaryColumn)}, ${wrapIdentifier(oldRelation.joiningColumn.columnName)}
			FROM ${wrapIdentifier(entity.tableName)}
			WHERE ${wrapIdentifier(oldRelation.joiningColumn.columnName)} IS NOT NULL`)

		builder.dropColumn(entity.tableName, oldRelation.joiningColumn.columnName)
	}

	public getSchemaUpdater(): SchemaUpdater {
		const { entityName } = this.data
		return updateSchema(
			this.subModification.getSchemaUpdater(),
			updateModel(updateEntity(entityName, addField(normalizeManyHasManyRelation(this.data.owningSide)))),
			this.data.inverseSide ? updateModel(updateEntity(this.data.owningSide.target, addField(this.data.inverseSide))) : undefined,
		)
	}

	describe() {
		return {
			message: `Converts OneHasMany relation to ManyHasMany on ${this.data.entityName}.${this.data.fieldName}`,
		}
	}

	private getRelation(): { entity: Model.Entity; relation: Model.ManyHasOneRelation } {
		const entity = this.schema.model.entities[this.data.entityName]
		const relation = entity.fields[this.data.fieldName]
		if (relation.type !== Model.RelationType.ManyHasOne) {
			throw new Error()
		}
		return { entity, relation }
	}
}

export const convertOneHasManyToManyHasManyRelationModification = createModificationType({
	id: 'convertOneHasManyToManyHasManyRelation',
	handler: ConvertOneHasManyToManyHasManyRelationModificationHandler,
})

export interface ConvertOneHasManyToManyHasManyRelationModificationData {
	entityName: string
	fieldName: string
	owningSide: PartialManyHasManyRelation
	inverseSide?: Model.ManyHasManyInverseRelation
}

export class ConvertOneHasManyToManyHasManyRelationDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				isInverseRelation(originalRelation) &&
				isInverseRelation(updatedRelation) &&
				originalRelation.type === Model.RelationType.OneHasMany &&
				updatedRelation.type === Model.RelationType.ManyHasMany
			) {
				const owningOldName = originalRelation.ownedBy
				const owningNewName = updatedRelation.ownedBy
				const owningSide = updatedSchema.model.entities[updatedRelation.target].fields[owningNewName]
				if (owningSide.type !== Model.RelationType.ManyHasMany || !isOwningRelation(owningSide)) {
					throw new Error()
				}
				return convertOneHasManyToManyHasManyRelationModification.createModification({
					entityName: updatedRelation.target,
					fieldName: owningOldName,
					owningSide,
					inverseSide: updatedRelation,
				})
			}
			return undefined
		})
	}
}
