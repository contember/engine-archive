import { assertNever, isIt } from '../utils'
import { Model } from '@contember/schema'

export enum ModelErrorCode {
	ENTITY_NOT_FOUND = 'entityNotFound',
	FIELD_NOT_FOUND = 'fieldNotFound',
	NOT_RELATION = 'notRelation',
	NOT_OWNING_SIDE = 'notOwningSide',
}

export class ModelError extends Error {
	constructor(public readonly code: ModelErrorCode, message: string) {
		super(message)
	}
}

const createEntityNotFoundError = (entityName: string) =>
	new ModelError(ModelErrorCode.ENTITY_NOT_FOUND, `Entity ${entityName} not found`)

const createFieldNotFoundError = (entityName: string, fieldName: string) =>
	new ModelError(ModelErrorCode.FIELD_NOT_FOUND, `Field ${fieldName} of entity ${entityName} not found`)

export const getEntity = (schema: Model.Schema, entityName: string): Model.Entity => {
	const entity = schema.entities[entityName]
	if (!entity) {
		throw createEntityNotFoundError(entityName)
	}
	return entity
}

export const getField = (entity: Model.Entity, fieldName: string): Model.AnyField => {
	const field = entity.fields[fieldName]
	if (!field) {
		throw createFieldNotFoundError(entity.name, fieldName)
	}
	return field
}

export const getColumnName = (schema: Model.Schema, entity: Model.Entity, fieldName: string) => {
	return acceptFieldVisitor(schema, entity, fieldName, {
		visitColumn: ({ column }) => column.columnName,
		visitRelation: ({ entity, relation }) => {
			if (isIt<Model.JoiningColumnRelation>(relation, 'joiningColumn')) {
				return relation.joiningColumn.columnName
			}
			throw new ModelError(
				ModelErrorCode.NOT_OWNING_SIDE,
				`Field ${relation.name} of entity ${entity.name} is not an owning side`,
			)
		},
	})
}

export const tryGetColumnName = (schema: Model.Schema, entity: Model.Entity, fieldName: string) => {
	try {
		return getColumnName(schema, entity, fieldName)
	} catch (e) {
		if (e instanceof ModelError && e.code === ModelErrorCode.NOT_OWNING_SIDE) {
			return undefined
		}
		throw e
	}
}

export const getColumnType = (schema: Model.Schema, entity: Model.Entity, fieldName: string): string => {
	return acceptFieldVisitor(schema, entity, fieldName, {
		// TODO solve enum handling properly maybe we should distinguish between domain and column type
		visitColumn: ({ column }) => (column.type === Model.ColumnType.Enum ? 'text' : column.columnType),
		visitRelation: ({ entity, relation, targetEntity }) => {
			if (isIt<Model.JoiningColumnRelation>(relation, 'joiningColumn')) {
				return getColumnType(schema, targetEntity, targetEntity.primary)
			}
			throw new ModelError(
				ModelErrorCode.NOT_OWNING_SIDE,
				`Field ${relation.name} of entity ${entity.name} is not an owning side`,
			)
		},
	})
}

export const getTargetEntity = (
	schema: Model.Schema,
	entity: Model.Entity,
	relationName: string,
): Model.Entity | null => {
	return acceptFieldVisitor(schema, entity, relationName, {
		visitColumn: () => null,
		visitRelation: ({ targetEntity }) => targetEntity,
	})
}

export const acceptEveryFieldVisitor = <T>(
	schema: Model.Schema,
	entity: string | Model.Entity,
	visitor: Model.FieldVisitor<T>,
): { [fieldName: string]: T } => {
	const entityObj: Model.Entity = typeof entity === 'string' ? getEntity(schema, entity) : entity

	const result: { [fieldName: string]: T } = {}
	for (const field in entityObj.fields) {
		result[field] = acceptFieldVisitor(schema, entityObj, field, visitor)
	}
	return result
}

export const acceptFieldVisitor = <T>(
	schema: Model.Schema,
	entity: string | Model.Entity,
	field: string | Model.AnyField,
	visitor: Model.FieldVisitor<T>,
): T => {
	const ctx = createRelationContext(schema, entity, field)

	if (isIt<Model.ColumnVisitor<T> & Model.RelationByTypeVisitor<T>>(visitor, 'visitManyHasManyInverse')) {
		return ctx.accept(visitor)
	}

	if (isIt<Model.ColumnVisitor<T> & Model.RelationVisitor<T>>(visitor, 'visitRelation')) {
		return ctx.accept({
			visitManyHasManyInverse: visitor.visitRelation.bind(visitor),
			visitManyHasManyOwning: visitor.visitRelation.bind(visitor),
			visitOneHasMany: visitor.visitRelation.bind(visitor),
			visitOneHasOneInverse: visitor.visitRelation.bind(visitor),
			visitOneHasOneOwning: visitor.visitRelation.bind(visitor),
			visitManyHasOne: visitor.visitRelation.bind(visitor),
			visitColumn: visitor.visitColumn.bind(visitor),
		})
	}

	if (isIt<Model.ColumnVisitor<T> & Model.RelationByGenericTypeVisitor<T>>(visitor, 'visitHasMany')) {
		return ctx.accept({
			visitManyHasManyInverse: visitor.visitHasMany.bind(visitor),
			visitManyHasManyOwning: visitor.visitHasMany.bind(visitor),
			visitOneHasMany: visitor.visitHasMany.bind(visitor),
			visitOneHasOneInverse: visitor.visitHasOne.bind(visitor),
			visitOneHasOneOwning: visitor.visitHasOne.bind(visitor),
			visitManyHasOne: visitor.visitHasOne.bind(visitor),
			visitColumn: visitor.visitColumn.bind(visitor),
		})
	}

	throw new Error()
}

export const acceptRelationTypeVisitor = <T>(
	schema: Model.Schema,
	entity: string | Model.Entity,
	relation: string | Model.AnyRelation,
	visitor: Model.RelationByTypeVisitor<T>,
): T => {
	const ctx = createRelationContext(schema, entity, relation)
	return ctx.accept({
		visitManyHasManyInverse: visitor.visitManyHasManyInverse.bind(visitor),
		visitManyHasManyOwning: visitor.visitManyHasManyOwning.bind(visitor),
		visitOneHasMany: visitor.visitOneHasMany.bind(visitor),
		visitManyHasOne: visitor.visitManyHasOne.bind(visitor),
		visitOneHasOneOwning: visitor.visitOneHasOneOwning.bind(visitor),
		visitOneHasOneInverse: visitor.visitOneHasOneInverse.bind(visitor),
		visitColumn: ctx => {
			throw new ModelError(
				ModelErrorCode.NOT_RELATION,
				`Field ${ctx.column.name} of entity ${ctx.entity.name} is not a relation`,
			)
		},
	})
}

const contextCache = new WeakMap<Model.Schema, Map<string, Model.AnyFieldContext>>()

const createRelationContext = (
	schema: Model.Schema,
	entity: string | Model.Entity,
	field: string | Model.AnyField,
): Model.AnyFieldContext => {
	let schemaContextCache = contextCache.get(schema)
	if (!schemaContextCache) {
		schemaContextCache = new Map()
		contextCache.set(schema, schemaContextCache)
	}
	const key = `${typeof entity === 'string' ? entity : entity.name}#${typeof field === 'string' ? field : field.name}`
	const cachedContext = schemaContextCache.get(key)
	if (cachedContext) {
		return cachedContext
	}

	const entityObj: Model.Entity = typeof entity === 'string' ? getEntity(schema, entity) : entity

	const fieldObj: Model.AnyField = typeof field === 'string' ? entityObj.fields[field] : field
	if (!fieldObj) {
		throw createFieldNotFoundError(entityObj.name, typeof field === 'string' ? field : 'unknown')
	}

	if (isIt<Model.AnyColumn>(fieldObj, 'columnType')) {
		const ctx: Model.ColumnContext = {
			entity: entityObj,
			column: fieldObj,
			accept: visitor => visitor.visitColumn(ctx),
		}
		schemaContextCache.set(key, ctx)
		return ctx
	}

	// if (!isRelation(relationObj)) {
	// 	throw new ModelError(
	// 		ModelErrorCode.NOT_RELATION,
	// 		`Field ${relationObj.name} of entity ${entityObj.name} is not a relation`,
	// 	)
	// }

	const targetEntity = getEntity(schema, fieldObj.target)

	if (isInverseRelation(fieldObj)) {
		const targetRelation = targetEntity.fields[fieldObj.ownedBy]
		switch (fieldObj.type) {
			case Model.RelationType.ManyHasMany: {
				const ctx: Model.ManyHasManyInverseContext = {
					type: 'manyHasManyInverse',
					entity: entityObj,
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.ManyHasManyOwningRelation,
					accept: visitor => visitor.visitManyHasManyInverse(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			}
			case Model.RelationType.OneHasOne: {
				const ctx: Model.OneHasOneInverseContext = {
					type: 'oneHasOneInverse',
					entity: entityObj,
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.OneHasOneOwningRelation,
					accept: visitor => visitor.visitOneHasOneInverse(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			}
			case Model.RelationType.OneHasMany: {
				const ctx: Model.OneHasManyContext = {
					type: 'oneHasMany',
					entity: entityObj,
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.ManyHasOneRelation,
					accept: visitor => visitor.visitOneHasMany(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			}
			default:
				return assertNever(fieldObj)
		}
	} else if (isOwningRelation(fieldObj)) {
		const targetRelation = fieldObj.inversedBy ? targetEntity.fields[fieldObj.inversedBy] : null

		switch (fieldObj.type) {
			case Model.RelationType.ManyHasMany: {
				const ctx: Model.ManyHasManyOwningContext = {
					type: 'manyHasManyOwning',
					entity: entityObj,
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.ManyHasManyInverseRelation,
					accept: visitor => visitor.visitManyHasManyOwning(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			}
			case Model.RelationType.OneHasOne: {
				const ctx: Model.OneHasOneOwningContext = {
					type: 'oneHasOneOwning',
					entity: entityObj,
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.OneHasOneInverseRelation,
					accept: visitor => visitor.visitOneHasOneOwning(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			}
			case Model.RelationType.ManyHasOne:
				const ctx: Model.ManyHasOneContext = {
					type: 'manyHasOne',
					entity: entityObj, //
					relation: fieldObj,
					targetEntity: targetEntity,
					targetRelation: targetRelation as Model.OneHasManyRelation,
					accept: visitor => visitor.visitManyHasOne(ctx),
				}
				schemaContextCache.set(key, ctx)
				return ctx
			default:
				return assertNever(fieldObj)
		}
	}

	throw new Error('Invalid relation type')
}

export const isRelation = (field: Model.AnyField): field is Model.AnyRelation => {
	return isIt<Model.Relation>(field, 'target')
}

export const isInverseRelation = (relation: Model.Relation): relation is Model.InverseRelation => {
	return (relation as Model.InverseRelation).ownedBy !== undefined
}

export const isOwningRelation = (relation: Model.Relation): relation is Model.OwningRelation => {
	return !isInverseRelation(relation)
}

export const isColumn = (field: Model.AnyField): field is Model.AnyColumn => isIt<Model.AnyColumn>(field, 'columnType')

export const emptyModelSchema: Model.Schema = { entities: {}, enums: {} }
