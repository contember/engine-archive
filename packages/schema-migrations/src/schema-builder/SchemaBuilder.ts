import { Acl, Input, Model, Schema, Value } from '@contember/schema'
import { acceptFieldVisitor, isInverseRelation, isOwningRelation, isRelation, PredicateDefinitionProcessor } from '@contember/schema-utils'
import { CreateColumnInput, SchemaPartsFactory } from './SchemaPartsFactory'
import {
	EntityUpdater,
	FieldUpdater,
	ModelUpdater,
	SchemaUpdater,
	updateAcl,
	updateAclEntities,
	updateAclEveryEntity,
	updateAclEveryPredicate,
	updateAclEveryRole,
	updateAclFieldPermissions,
	updateEntity,
	updateEveryEntity,
	updateEveryField,
	updateField,
	updateModel,
	updateSchema,
} from './schemaUpdateUtils'
import deepEqual from 'fast-deep-equal'
import { isIt } from '../utils/isIt'
import { changeValue } from '../modifications/utils/valueUtils'

export class SchemaBuilder {
	constructor(
		public readonly schema: Schema,
		private errorHandler: SchemaBuilderErrorHandler,
		private partsFactory: SchemaPartsFactory,
		private options: {
			patchAcl?: boolean
			removeReferencingRelation?: boolean
			removeRelationInverseSide?: boolean
			updateConstraintFields?: boolean
			updateIndexesFields?: boolean
		},
	) {
	}

	public addEntity(entity: { name: string } & Partial<Omit<Model.Entity, 'name'>>) {
		return this.updateModel(({ model }) => {
			if (entity.name in this.schema.model.entities) {
				this.errorHandler.entityAlreadyExists(entity.name)
				return model
			}
			const fullEntity = this.partsFactory.createEntity(entity)
			return {
				...model,
				entities: {
					...model.entities,
					[fullEntity.name]: fullEntity,
				},
			}
		})
	}

	public removeEntity(entityName: string) {
		if (!this.schema.model.entities[entityName]) {
			this.errorHandler.entityNotFound(entityName)
			return this
		}

		let builder: SchemaBuilder = this
		if (this.options.patchAcl !== false) {
			builder = builder.updateSchema(updateAcl(
				updateAclEveryRole(
					({ role }) => ({
						...role,
						variables: Object.fromEntries(
							Object.entries(role.variables).filter(([, variable]) =>
								variable.type !== Acl.VariableType.entity || variable.entityName !== entityName,
							),
						),
					}),
					updateAclEntities(({ entities }) => {
						const { [entityName]: removed, ...other } = entities
						return other
					}),
					updateAclEveryEntity(
						updateAclEveryPredicate(({ predicate, entityName, schema }) => {
							const processor = new PredicateDefinitionProcessor(schema.model)
							const currentEntity = schema.model.entities[entityName]
							return processor.process(currentEntity, predicate, {
								handleColumn: ctx => {
									return ctx.entity.name === entityName ? undefined : ctx.value
								},
								handleRelation: ctx => {
									return ctx.entity.name === entityName ? undefined : ctx.value
								},
							})
						}),
					),
				),
			))
		}
		if (this.options.removeReferencingRelation !== false) {
			const fieldsToRemove = Object.values(this.schema.model.entities).flatMap(entity =>
				Object.values(entity.fields)
					.filter(field => isRelation(field) && field.target === entityName)
					.map((field): [string, string] => [entity.name, field.name]),
			)
			for (const field of fieldsToRemove) {
				builder = builder.removeField(field[0], field[1])
			}
		}
		return this.updateModel(({ model }) => {
			const { [entityName]: removed, ...entities } = model.entities
			return {
				...model,
				entities: { ...entities },
			}
		})
	}

	public updateEntityName(entityName: string, newEntityName: string) {
		let builder = this
			.updateModel(updateEveryEntity(
				updateEveryField(({ field }) => {
					if (isIt<Model.AnyRelation>(field, 'target') && field.target === entityName) {
						return { ...field, target: newEntityName }
					}
					return field
				}),
			))
			.updateModel(({ model }) => {
				const { [entityName]: renamed, ...entities } = model.entities
				const newEntities = {
					...entities,
					[newEntityName]: {
						...renamed,
						name: newEntityName,
					},
				}
				return {
					...model,
					entities: newEntities,
				}
			})
		if (this.options.patchAcl !== false) {
			builder = this.updateSchema(updateAcl(
				updateAclEveryRole(
					({ role }) => ({
						...role,
						variables: Object.fromEntries(
							Object.entries(role.variables).map(([key, variable]) => {
								if (variable.type === Acl.VariableType.entity) {
									return [
										key,
										{
											...variable,
											entityName: changeValue(entityName, newEntityName)(variable.entityName),
										},
									]
								}
								return [key, variable]
							}),
						),
					}),
					updateAclEntities(({ entities }) => {
						if (!entities[entityName]) {
							return entities
						}
						const { [entityName]: renamed, ...other } = entities
						return {
							[newEntityName]: renamed,
							...other,
						}
					}),
				),
			))
		}

		return builder
	}

	public createUnique(entityName: string, unique: Model.UniqueConstraint) {
		return this.updateEntity(entityName, ({ entity }) => {
			return {
				...entity,
				unique: [...entity.unique, unique],
			}
		})
	}

	public removeUnique(entityName: string, unique: Model.UniqueConstraint) {
		return this.updateEntity(entityName, ({ entity }) => {
			const newUnique = entity.unique.filter(it => !deepEqual(it.fields, unique.fields))
			return {
				...entity,
				unique: newUnique,
			}
		})
	}

	public createIndex(entityName: string, index: Model.Index) {
		return this.updateEntity(entityName, ({ entity }) => {
			return {
				...entity,
				indexes: [...entity.indexes, index],
			}
		})
	}

	public removeIndex(entityName: string, index: Model.Index) {
		return this.updateEntity(entityName, ({ entity }) => {
			const indexes = entity.indexes.filter(it => !deepEqual(it.fields, index.fields))
			return {
				...entity,
				indexes,
			}
		})
	}

	public addColumn(entityName: string, column: CreateColumnInput) {
		return this.addField(entityName, this.partsFactory.createColumn(column))
	}

	public addRelation(entityName: string, relation: Model.AnyRelation) {
		return this.addField(entityName, relation)
	}


	public addField(entityName: string, field: Model.AnyField) {
		return this.updateEntity(entityName, ({ entity }) => {
			if (field.name in entity.fields) {
				this.errorHandler.fieldAlreadyExists(entityName, field.name)
				return entity
			}
			return {
				...entity,
				fields: {
					...entity.fields,
					[field.name]: field,
				},
			}
		})
	}


	removeField(entityName: string, fieldName: string): SchemaBuilder {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let builder: SchemaBuilder = this

		const entity = this.schema.model.entities[entityName]
		if (!entity) {
			this.errorHandler.entityNotFound(entityName)
			return this
		}
		const field = entity.fields[fieldName]
		if (!field) {
			this.errorHandler.fieldNotFound(entityName, fieldName)
			return this
		}

		if (this.options.patchAcl !== false) {
			builder = this.updateSchema(updateAcl(
				updateAclEveryRole(
					updateAclEveryEntity(
						updateAclFieldPermissions((permissions, entityName) => {
							if (entityName !== entity.name) {
								return permissions
							}
							const { [fieldName]: field, ...other } = permissions
							return {
								...other,
							}
						}),
						updateAclEveryPredicate(({ predicate, entityName, schema }) => {
							const processor = new PredicateDefinitionProcessor(schema.model)
							return processor.process(schema.model.entities[entityName], predicate, {
								handleColumn: ctx =>
									ctx.entity.name === entity.name && ctx.column.name === field.name ? undefined : ctx.value,
								handleRelation: ctx =>
									ctx.entity.name === entity.name && ctx.relation.name === field.name ? undefined : ctx.value,
							})
						}),
					),
				),
			))
		}

		if (isRelation(field) && isOwningRelation(field) && field.inversedBy && this.options.removeRelationInverseSide) {
			builder = builder.removeField(field.target, field.inversedBy)
		}

		builder = builder.updateEntity(
			entity.name,
			({ entity }) => {
				const { [field.name]: removed, ...fields } = entity.fields
				const indexes = entity.indexes.filter(index => !index.fields.includes(field.name))
				const unique = entity.unique.filter(index => !index.fields.includes(field.name))
				return {
					...entity,
					fields,
					indexes,
					unique,
				}
			},
		)
		if (isRelation(field) && isInverseRelation(field)) {
			builder = this.updateEntity(
				field.target,
				updateField<Model.AnyOwningRelation>(field.ownedBy, ({ field: { inversedBy, ...field } }) => field),
			)
		}

		return builder
	}

	updateFieldName(entityName: string, fieldName: string, newFieldName: string) {
		let builder: SchemaBuilder = this

		if (this.options.patchAcl !== false) {
			builder = builder.updateSchema(updateAcl(
				updateAclEveryRole(
					updateAclEveryEntity(
						updateAclFieldPermissions((permissions, entityName) => {
							if (entityName !== entityName) {
								return permissions
							}
							if (!permissions[fieldName]) {
								return permissions
							}
							const { [fieldName]: field, ...other } = permissions
							return {
								[newFieldName]: field,
								...other,
							}
						}),
						updateAclEveryPredicate(({ predicate, entityName, schema }) => {
							const processor = new PredicateDefinitionProcessor(schema.model)
							const currentEntity = schema.model.entities[entityName]
							return processor.process<Input.Condition<Value.FieldValue<never>> | string, never>(
								currentEntity,
								predicate,
								{
									handleColumn: ctx =>
										ctx.entity.name === entityName && ctx.column.name === fieldName
											? [newFieldName, ctx.value]
											: ctx.value,
									handleRelation: ctx =>
										ctx.entity.name === entityName && ctx.relation.name === fieldName
											? [newFieldName, ctx.value]
											: ctx.value,
								},
							)
						}),
					),
				),
			))
		}
		if (this.options.updateConstraintFields !== false) {
			builder = builder.updateEntity(entityName, ({ entity }) => {
				return {
					...entity,
					unique: entity.unique.map(unique => ({
						...unique,
						fields: unique.fields.map(changeValue(fieldName, newFieldName)),
					})),
				}
			})
		}
		if (this.options.updateIndexesFields !== false) {
			builder = builder.updateEntity(entityName, ({ entity }) => {
				return {
					...entity,
					indexes: entity.indexes.map(unique => ({
						...unique,
						fields: unique.fields.map(changeValue(fieldName, newFieldName)),
					})),
				}
			})
		}

		builder = builder
			.updateModel(updateEveryEntity(
				updateEveryField(({ field, entity }) => {
					const isUpdatedRelation = (entity: Model.Entity, relation: Model.AnyRelation | null) => {
						return entity.name === entityName && relation && relation.name === fieldName
					}

					return acceptFieldVisitor<Model.AnyField>(this.schema.model, entity, field, {
						visitColumn: ({ column }) => column,
						visitManyHasOne: ({ targetEntity, relation, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, inversedBy: newFieldName }
								: relation
						},
						visitOneHasMany: ({ relation, targetEntity, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, ownedBy: newFieldName }
								: relation
						},
						visitOneHasOneOwning: ({ relation, targetEntity, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, inversedBy: newFieldName }
								: relation
						},
						visitOneHasOneInverse: ({ relation, targetEntity, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, ownedBy: newFieldName }
								: relation
						},
						visitManyHasManyOwning: ({ relation, targetEntity, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, inversedBy: newFieldName }
								: relation
						},
						visitManyHasManyInverse: ({ relation, targetEntity, targetRelation }) => {
							return isUpdatedRelation(targetEntity, targetRelation)
								? { ...relation, ownedBy: newFieldName }
								: relation
						},
					})
				}),
			),
			)
			.updateEntity(entityName, ({ entity }) => {
				const { [fieldName]: updated, ...fields } = entity.fields
				return {
					...entity,
					fields: {
						...fields,
						[newFieldName]: { ...updated, name: newFieldName },
					},
				}
			})

		return builder
	}

	public updateColumnDefinition(entityName: string, fieldName: string, definition: ColumnDefinitionAlter) {
		return this.updateField(entityName, fieldName, isFieldType(['column']), ({ field }) => ({
			...definition,
			name: field.name,
			columnName: field.columnName,
		}))
	}

	public updateRelationOnDelete(entityName: string, fieldName: string, onDelete: Model.OnDelete) {
		return this.updateField(entityName, fieldName, isFieldType(['oneHasOneOwning', 'manyHasOne']), ({ field }) => ({
			...field,
			joiningColumn: { ...field.joiningColumn, onDelete },
		}))
	}

	public updateRelationOrderBy(entityName: string, fieldName: string, orderBy: readonly Model.OrderBy[]) {
		return this.updateField(entityName, fieldName, isFieldType(['oneHasMany', 'manyHasManyOwning', 'manyHasManyInverse']), ({ field }) => ({
			...field,
			orderBy,
		}))
	}

	public updateRelationOrphanRemoval(entityName: string, fieldName: string, newValue: boolean) {
		return this.updateField(entityName, fieldName, isFieldType(['oneHasOneOwning']), ({ field: { orphanRemoval, ...field } }) => ({
			...field,
			...(newValue ? {
				orphanRemoval: true,
			} : {}),
		}))
	}

	public updateRelationNullable(entityName: string, fieldName: string, nullable: boolean) {
		return this.updateField(entityName, fieldName, isFieldType(['oneHasOneOwning', 'oneHasOneInverse', 'manyHasOne']), ({ field }) => ({
			...field,
			nullable,
		}))
	}

	public updateJunctionEventLog(entityName: string, fieldName: string, enabled: boolean) {
		return this.updateField(entityName, fieldName, isFieldType(['manyHasManyOwning']), ({ field: { joiningTable: { eventLog, ...joiningTable }, ...field } }) => {
			return {
				...field,
				joiningTable: {
					...joiningTable,
					eventLog: {
						enabled,
					},
				},
			}
		})
	}

	public addEnum(_enum: {
		enumName: string
		values: readonly string[]
	}) {
		if (_enum.enumName in this.schema.model.enums) {
			this.errorHandler.enumAlreadyExists(_enum.enumName)
			return this
		}
		return this.updateModel(({ model }) => ({
			...model,
			enums: {
				...model.enums,
				[_enum.enumName]: _enum.values,
			},
		}))
	}

	public removeEnum(enumName: string) {
		if (!(enumName in this.schema.model.enums)) {
			this.errorHandler.enumNotFound(enumName)
			return this
		}
		return this.updateModel(({ model }) => {
			const { [enumName]: removedEnum, ...enums } = model.enums
			return {
				...model,
				enums,
			}
		})
	}

	public updateEnumValues(enumName: string, values: readonly string[]) {
		if (!(enumName in this.schema.model.enums)) {
			this.errorHandler.enumNotFound(enumName)
			return this
		}
		return this.updateModel(({ model }) => ({
			...model,
			enums: {
				...model.enums,
				[enumName]: values,
			},
		}))
	}


	public updateSchema(schemaUpdater: SchemaUpdater) {
		return this.withSchema(updateSchema(schemaUpdater)({ schema: this.schema }))
	}

	public updateModel(modelUpdater: ModelUpdater) {
		return this.withSchema(updateModel(modelUpdater)({ schema: this.schema }))
	}

	public updateEntity(entityName: string, entityUpdater: EntityUpdater) {
		const entity = this.schema.model.entities[entityName]
		if (!entity) {
			this.errorHandler.entityNotFound(entityName)
			return this
		}

		return this.updateModel(updateEntity(entityName, entityUpdater))
	}


	public updateField<In extends Model.AnyField = Model.AnyField>(entityName: string, fieldName: string, fieldAssertion: FieldAssertion<In>, fieldUpdater: FieldUpdater<In, Model.AnyField>) {
		return this.updateEntity(entityName, args => {
			if (!(fieldName in args.entity.fields)) {
				this.errorHandler.fieldNotFound(entityName, fieldName)
				return args.entity
			}
			const field = args.entity.fields[fieldName]
			if (fieldAssertion && !fieldAssertion(args.model, args.entity, field)) {
				this.errorHandler.invalidFieldType(entityName, fieldName, field.type)
				return args.entity
			}
			return updateField<In, Model.AnyField>(fieldName, fieldUpdater)(args)
		})
	}

	private withSchema(schema: Schema): SchemaBuilder {
		return new SchemaBuilder(schema, this.errorHandler, this.partsFactory, this.options)
	}
}


type SequenceDefinitionAlter =
	& Model.AnyColumn['sequence']
	& {
		restart?: boolean
	}

export type ColumnDefinitionAlter =
	& Omit<Model.AnyColumn, 'sequence' | 'columnName' | 'name'>
	& {
		sequence?: SequenceDefinitionAlter
	}

type FieldAssertion<T extends Model.AnyField> = (model: Model.Schema, entity: Model.Entity, field: Model.AnyField) => field is T

type FieldType = Model.AnyFieldContext['type']

type FieldTypeToField<T extends FieldType> =
	| (T extends 'manyHasManyInverse' ? Model.ManyHasManyInverseRelation : never)
	| (T extends 'manyHasManyOwning' ? Model.ManyHasManyOwningRelation : never)
	| (T extends 'manyHasOne' ? Model.ManyHasOneRelation : never)
	| (T extends 'oneHasMany' ? Model.OneHasManyRelation : never)
	| (T extends 'oneHasOneInverse' ? Model.OneHasOneInverseRelation : never)
	| (T extends 'oneHasOneOwning' ? Model.OneHasOneOwningRelation : never)
	| (T extends 'column' ? Model.AnyColumn : never)

export const isFieldType = <T extends Model.AnyFieldContext['type']>(types: T[]): FieldAssertion<FieldTypeToField<T>> => {
	return (model, entity, field): field is FieldTypeToField<T> => {
		return acceptFieldVisitor<boolean>(model, entity, field, {
			visitColumn: () => types.includes('column' as T),
			visitManyHasOne: () => types.includes('manyHasOne' as T),
			visitOneHasMany: () => types.includes('oneHasMany' as T),
			visitOneHasOneOwning: () => types.includes('oneHasOneOwning' as T),
			visitOneHasOneInverse: () => types.includes('oneHasOneInverse' as T),
			visitManyHasManyOwning: () => types.includes('manyHasManyOwning' as T),
			visitManyHasManyInverse: () => types.includes('manyHasManyInverse' as T),
		})
	}

}

export interface SchemaBuilderErrorHandler {
	entityNotFound: (entityName: string) => void
	entityAlreadyExists: (entityName: string) => void
	fieldNotFound: (entityName: string, fieldName: string) => void
	fieldAlreadyExists: (entityName: string, fieldName: string) => void
	invalidFieldType: (entityName: string, fieldName: string, actualType: string) => void
	enumNotFound: (enumName: string) => void
	enumAlreadyExists: (enumName: string) => void
}

export const schemaBuilderErrorFormatter: {
	[K in keyof SchemaBuilderErrorHandler]: (...args: Parameters<SchemaBuilderErrorHandler[K]>) => string
} = {
	entityAlreadyExists: entityName => `Entity ${entityName} already exists`,
	entityNotFound: entityName => `Entity ${entityName} not found`,
	fieldAlreadyExists: (entityName, fieldName) => `Field ${entityName}.${fieldName} already exists`,
	fieldNotFound: (entityName, fieldName) => `Field ${entityName}.${fieldName} not found`,
	invalidFieldType: (entityName, fieldName, actualType) => `Field ${entityName}.${fieldName} has unexpected type ${actualType}`,
	enumAlreadyExists: enumName => `Entity ${enumName} alreadyExists`,
	enumNotFound: enumName => `Entity ${enumName} not found`,
}

const schemaBuilderErrors = Object.keys(schemaBuilderErrorFormatter) as (keyof SchemaBuilderErrorHandler)[]

export const throwingSchemaBuilderErrorHandler: SchemaBuilderErrorHandler = (() => {
	const handler: SchemaBuilderErrorHandler = {} as SchemaBuilderErrorHandler
	for (const key of schemaBuilderErrors) {
		const thisHandler = (...args: Parameters<SchemaBuilderErrorHandler[typeof key]>) => {
			throw new Error((schemaBuilderErrorFormatter[key] as any)(args))
		}
		handler[key] = thisHandler
	}
	return handler
})()
