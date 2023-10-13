import { Acl, Model, Schema, Writable } from '@contember/schema'
import { SchemaUpdateError } from '../modifications/exceptions'
import { isDefined } from '../utils/isDefined'


export type SchemaUpdater = (args: { schema: Schema }) => Schema
export type ModelUpdater = (args: { schema: Schema; model: Model.Schema }) => Model.Schema
export type EntityUpdater = (args: { schema: Schema; model: Model.Schema; entity: Model.Entity }) => Model.Entity
export type FieldUpdater<In extends Model.AnyField, Out extends Model.AnyField> = (args: {
	schema: Schema
	model: Model.Schema
	entity: Model.Entity
	field: In
}) => Out | undefined
export type AclUpdater = (args: { schema: Schema; acl: Acl.Schema }) => Acl.Schema
export type AclRoleUpdater = (args: {
	schema: Schema
	acl: Acl.Schema
	role: Acl.RolePermissions
}) => Acl.RolePermissions
export type AclPermissionsUpdater = (args: {
	schema: Schema
	acl: Acl.Schema
	role: Acl.RolePermissions
	entities: Acl.Permissions
}) => Acl.Permissions

export type AclEntityPermissionsUpdater = (args: {
	schema: Schema
	acl: Acl.Schema
	role: Acl.RolePermissions
	entities: Acl.Permissions
	entityName: string
	entityPermissions: Acl.EntityPermissions
}) => Acl.EntityPermissions

export type EntityAclEveryPredicatesUpdater = (args: {
	schema: Schema
	acl: Acl.Schema
	role: Acl.RolePermissions
	entities: Acl.Permissions
	entityName: string
	entityPermissions: Acl.EntityPermissions
	predicate: Acl.PredicateDefinition
}) => Acl.PredicateDefinition

export const updateSchema =
	(...schemaUpdater: (SchemaUpdater | undefined)[]): SchemaUpdater =>
		args =>
			schemaUpdater.filter(isDefined).reduce((schema, updater) => updater({ ...args, schema }), args.schema)

export const updateAcl =
	(updater: AclUpdater): SchemaUpdater =>
		args => ({
			...args.schema,
			acl: updater({ schema: args.schema, acl: args.schema.acl }),
		})

export const updateAclEveryRole =
	(...updater: AclRoleUpdater[]): AclUpdater =>
		args => ({
			...args.acl,
			roles: Object.fromEntries(
				updater.reduce(
					(acc, updater) => acc.map(([name, role]) => [name, updater({ ...args, role })]),
					Object.entries(args.acl.roles),
				),
			),
		})

export const updateAclEntities =
	(updater: AclPermissionsUpdater): AclRoleUpdater =>
		args => ({
			...args.role,
			entities: updater({ ...args, entities: args.role.entities }),
		})

export const updateAclEveryEntity =
	(...updater: AclEntityPermissionsUpdater[]): AclRoleUpdater =>
		args => ({
			...args.role,
			entities: Object.fromEntries(
				updater.reduce(
					(acc, updater) =>
						acc.map(([entity, entityPermissions]) => [
							entity,
							updater({
								...args,
								entities: args.role.entities,
								entityName: entity,
								entityPermissions,
							}),
						]),
					Object.entries(args.role.entities),
				),
			),
		})

type EntityAclFieldPermissionsUpdater = (
	fieldPermissions: Acl.FieldPermissions,
	entityName: string,
	operation: Acl.Operation,
) => Acl.FieldPermissions
type EntityOperationHandler = {
	[K in keyof Required<Acl.EntityOperations>]: (
		value: Exclude<Acl.EntityOperations[K], undefined>,
	) => Acl.EntityOperations[K]
}

export const updateAclFieldPermissions =
	(updater: EntityAclFieldPermissionsUpdater): AclEntityPermissionsUpdater =>
		({ entityPermissions, entityName }) => {
			const operations: Writable<Acl.EntityOperations> = {}
			const handlers: EntityOperationHandler = {
				create: value => updater(value, entityName, Acl.Operation.create),
				update: value => updater(value, entityName, Acl.Operation.update),
				read: value => updater(value, entityName, Acl.Operation.read),
				delete: value => value,
				customPrimary: value => value,
			}
			const types: (keyof Acl.EntityOperations)[] = ['create', 'update', 'read', 'delete', 'customPrimary']
			for (const key of types) {
				if (key in entityPermissions.operations) {
					operations[key] = handlers[key](entityPermissions.operations[key] as any) as any
				}
			}

			return {
				...entityPermissions,
				operations,
			}
		}

export const updateAclEveryPredicate =
	(updater: EntityAclEveryPredicatesUpdater): AclEntityPermissionsUpdater =>
		args => {
			return {
				...args.entityPermissions,
				predicates: Object.fromEntries(
					Object.entries(args.entityPermissions.predicates).map(([name, predicate]) => [
						name,
						updater({
							...args,
							predicate,
						}),
					]),
				),
			}
		}

export const updateModel =
	(...modelUpdate: (ModelUpdater | undefined)[]): SchemaUpdater =>
		args => ({
			...args.schema,
			model: modelUpdate
				.filter((it): it is ModelUpdater => it !== undefined)
				.reduce((model, updater) => updater({ ...args, model }), args.schema.model),
		})

export const updateEntity =
	(name: string, entityUpdate: EntityUpdater): ModelUpdater =>
		args => {
			if (!args.model.entities[name]) {
				throw new SchemaUpdateError(`Entity ${name} not found`)
			}
			return {
				...args.model,
				entities: {
					...args.model.entities,
					[name]: entityUpdate({ ...args, entity: args.model.entities[name] }),
				},
			}
		}

export const updateEveryEntity =
	(entityUpdate: EntityUpdater): ModelUpdater =>
		args => ({
			...args.model,
			entities: Object.fromEntries(
				Object.entries(args.model.entities).map(([name, entity]) => [name, entityUpdate({ ...args, entity })]),
			),
		})

export const updateField =
	<In extends Model.AnyField = Model.AnyField, Out extends Model.AnyField = In>(name: string, fieldUpdater: FieldUpdater<In, Out>): EntityUpdater =>
		args => {
			const { [name]: field, ...otherFields } = args.entity.fields
			if (!args.entity.fields[name]) {
				throw new SchemaUpdateError(`Field ${args.entity.name}::${name} not found`)
			}
			const updatedField = fieldUpdater({ ...args, field: args.entity.fields[name] as In })

			return {
				...args.entity,
				fields: {
					...otherFields,
					...(updatedField ? { [name]: updatedField } : {}),
				},
			}
		}

export const updateEveryField =
	(fieldUpdater: FieldUpdater<Model.AnyField, Model.AnyField>): EntityUpdater =>
		args => ({
			...args.entity,
			fields: Object.fromEntries(
				Object.entries(args.entity.fields)
					.map(([name, field]) => {
						const updatedField = fieldUpdater({ ...args, field })
						if (!updatedField) {
							return undefined
						}
						return [name, updatedField]
					})
					.filter(isDefined),
			),
		})

export const addField =
	(field: Model.AnyField): EntityUpdater =>
		args => {
			return {
				...args.entity,
				fields: {
					...args.entity.fields,
					[field.name]: field,
				},
			}
		}
