import { MigrationBuilder } from '@contember/database-migrations'
import { Model, Schema } from '@contember/schema'
import {
	addTakenIndexName,
	SchemaUpdater,
	updateEntity,
	updateField,
	updateModel,
	updateSchema,
} from '../utils/schemaUpdateUtils'
import {
	createModificationType,
	Differ,
	ModificationHandler,
	ModificationHandlerOptions,
} from '../ModificationHandler'
import { isOwningRelation, NamingHelper } from '@contember/schema-utils'
import { updateRelations } from '../utils/diffUtils'
import { NoopModification } from '../NoopModification'
import { updateFieldNameModification } from '../fields'
import { resolveIndexName, SchemaWithMeta } from '../utils/schemaMeta'

export class ConvertOneToManyRelationModificationHandler implements ModificationHandler<ConvertOneToManyRelationModificationData> {
	private subModification: ModificationHandler<any>

	constructor(
		private readonly data: ConvertOneToManyRelationModificationData,
		private readonly schema: SchemaWithMeta,
		private readonly options: ModificationHandlerOptions,
	) {
		const { relation } = this.getRelation()
		this.subModification = data.newInverseSideFieldName && relation.inversedBy ?
			updateFieldNameModification.createHandler(
				{
					entityName: relation.target,
					fieldName: relation.inversedBy,
					newFieldName: data.newInverseSideFieldName,
				},
				schema,
				this.options,
			)
			: new NoopModification()
	}

	public createSql(builder: MigrationBuilder): void {
		const { entity, relation } = this.getRelation()
		if (!entity.migrations.enabled) {
			return
		}
		const columnName = relation.joiningColumn.columnName
		const proposedIndexName = NamingHelper.createForeignKeyIndexName(entity.tableName, columnName)
		const indexName = resolveIndexName(this.schema, proposedIndexName)
		builder.addIndex(entity.tableName, columnName, {
			name: indexName,
		})
		const uniqueConstraintName = NamingHelper.createUniqueConstraintName(entity.name, [relation.name])
		builder.dropConstraint(entity.tableName, uniqueConstraintName)
		this.subModification.createSql(builder)
	}

	public getSchemaUpdater(): SchemaUpdater {
		const { relation } = this.getRelation()
		const { entityName, fieldName } = this.data
		const entity = this.schema.model.entities[this.data.entityName]
		const field = entity.fields[fieldName] as Model.OneHasOneOwningRelation
		return updateSchema(
			updateModel(
				updateEntity(
					entityName,
					updateField<Model.OneHasOneOwningRelation, Model.ManyHasOneRelation>(
						fieldName,
						({ field: { type, orphanRemoval, ...field } }) => ({
							type: Model.RelationType.ManyHasOne,
							...field,
						}),
					),
				),
			),
			this.subModification.getSchemaUpdater(),
			this.data.newInverseSideFieldName ?
				updateModel(
					updateEntity(
						relation.target,
						updateField<Model.OneHasOneInverseRelation, Model.OneHasManyRelation>(
							this.data.newInverseSideFieldName,
							({ field: { type,  nullable, ...field } }) => ({
								type: Model.RelationType.OneHasMany,
								...field,
							}),
						),
					),
				) : undefined,
			addTakenIndexName(NamingHelper.createForeignKeyIndexName(entity.tableName, field.joiningColumn.columnName)),
		)
	}

	describe() {
		return {
			message: `Converts OneHasOne relation to ManyHasOne on ${this.data.entityName}.${this.data.fieldName}`,
		}
	}

	private getRelation() {
		const entity = this.schema.model.entities[this.data.entityName]
		const relation = entity.fields[this.data.fieldName]
		if (relation.type !== Model.RelationType.OneHasOne || !isOwningRelation(relation)) {
			throw new Error()
		}
		return { entity, relation }
	}
}

export interface ConvertOneToManyRelationModificationData {
	entityName: string
	fieldName: string
	newInverseSideFieldName?: string
}

export const convertOneToManyRelationModification = createModificationType({
	id: 'convertOneToManyRelation',
	handler: ConvertOneToManyRelationModificationHandler,
})

export class ConvertOneToManyRelationDiffer implements Differ {
	createDiff(originalSchema: Schema, updatedSchema: Schema) {
		return updateRelations(originalSchema, updatedSchema, ({ originalRelation, updatedRelation, updatedEntity }) => {
			if (
				isOwningRelation(originalRelation) &&
				isOwningRelation(updatedRelation) &&
				originalRelation.type === Model.RelationType.OneHasOne &&
				updatedRelation.type === Model.RelationType.ManyHasOne
			) {
				const isInverseSideRenamed = originalRelation.inversedBy && updatedRelation.inversedBy && originalRelation.inversedBy !== updatedRelation.inversedBy
				return convertOneToManyRelationModification.createModification({
					entityName: updatedEntity.name,
					fieldName: updatedRelation.name,
					...(isInverseSideRenamed ? {
						newInverseSideFieldName: updatedRelation.inversedBy,
					} : {}),
				})
			}
			return undefined
		})
	}
}
