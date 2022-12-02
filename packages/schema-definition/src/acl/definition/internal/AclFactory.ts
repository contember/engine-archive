import { Acl, Model, Writable } from '@contember/schema'
import { getEntity } from '@contember/schema-utils'

import { EntityPredicatesResolver } from './EntityPredicateResolver'
import { AllowDefinition } from '../permissions'
import { allowDefinitionsStore, EntityPermissionsDefinition, entityPermissionsExtensionStore } from './stores'
import { anyRole, Role } from '../roles'
import { VariableDefinition } from '../variables'
import { filterEntityDefinition } from '../../../utils'
import { EntityConstructor } from '../../../model/definition/types'

export class AclFactory {
	constructor(
		private model: Model.Schema,
	) {
	}

	public create(
		exportedDefinitions: Record<string, any>,
	): Acl.Schema {
		const entityLikeDefinition = filterEntityDefinition(exportedDefinitions)
		const roles: Role[] = Object.values(exportedDefinitions).filter(it => it instanceof Role)
		const variables: VariableDefinition[] = Object.values(exportedDefinitions).filter(it => it instanceof VariableDefinition)

		const groupedPermissions = AclFactory.groupPermissions(entityLikeDefinition, roles)

		return {
			roles: Object.fromEntries(roles.map((role): [string, Acl.RolePermissions] => {
				const rolePermissions = groupedPermissions.get(role)
				const basePermissions = this.createPermissions(rolePermissions)
				return [
					role.name,
					{
						...role.options,
						stages: role.options.stages ?? '*',
						entities: this.extendPermissions(role, entityLikeDefinition, basePermissions),
						variables: this.createVariables(role, variables),
					},
				]
			})),
		}
	}

	private extendPermissions(role: Role, entityLikeDefinition: [string, EntityConstructor][], basePermissions: Acl.Permissions): Acl.Permissions {
		const permissions: [string, Acl.EntityPermissions][] = []
		for (const [name, constructor] of entityLikeDefinition) {
			const entity = this.model.entities[name]
			if (!entity) {
				continue // probably not an entity
			}

			const entityPermissions = this.createEntityPermissions(role, constructor, entity, basePermissions[entity.name])
			if (entityPermissions !== undefined) {
				permissions.push([name, entityPermissions])
			}
		}
		return Object.fromEntries(permissions)
	}

	private createEntityPermissions(role: Role, entityConstructor: EntityConstructor, entity: Model.Entity, basePermissions?: Acl.EntityPermissions): Acl.EntityPermissions | undefined {
		const extensions = entityPermissionsExtensionStore.get(entityConstructor)
			.filter(({ roles }) => roles === anyRole || roles === role || (Array.isArray(roles) && roles.includes(role)))

		if (extensions.length === 0) {
			return basePermissions
		}

		const permissions = basePermissions ?? {
			operations: {},
			predicates: {},
		}

		return extensions.reduce((acc, it) => it.extension({
			entity,
			permissions: acc,
		}), permissions)
	}

	private createPermissions(rolePermissions: PermissionsByEntity | undefined): Acl.Permissions {
		if (!rolePermissions) {
			return {}
		}
		return Object.fromEntries(Array.from(rolePermissions.keys()).map((entityName): [string, Acl.EntityPermissions] => {
			const entity = getEntity(this.model, entityName)

			const predicatesResolver = EntityPredicatesResolver.create(rolePermissions, this.model, entity)

			const entityOperations: Writable<Acl.EntityOperations> = {}
			for (const op of ['create', 'update', 'read'] as const) {
				const fieldPermissions: Writable<Acl.FieldPermissions> = {}
				for (const field of Object.keys(entity.fields)) {
					if (field === entity.primary) {
						continue
					}
					const predicate = predicatesResolver.createFieldPredicate(op, field)
					if (predicate !== undefined) {
						fieldPermissions[field] = predicate
					}
				}
				if (Object.keys(fieldPermissions).length > 0) {
					entityOperations[op] = fieldPermissions
				}
			}
			const delPredicate = predicatesResolver.createFieldPredicate('delete', '')
			if (delPredicate !== undefined) {
				entityOperations.delete = delPredicate
			}
			return [entityName, {
				predicates: predicatesResolver.getUsedPredicates(),
				operations: entityOperations,
			}]
		}))
	}

	private createVariables(role: Role, variables: VariableDefinition[]): Acl.Variables {
		const roleVariables = variables.filter(it => it.roles.includes(role))
		return Object.fromEntries(roleVariables.map((variable): [string, Acl.Variable] => {
			return [variable.name, variable.variable]
		}))
	}

	private static groupPermissions(entityLikeDefinition: [string, EntityConstructor][], roles: Role[]): PermissionsByRoleAndEntity {
		const groupedPermissions: PermissionsByRoleAndEntity = new Map()
		for (const [name, entity] of entityLikeDefinition) {
			const initEntityPermissions = (role: Role): EntityPermissions => {
				const rolePermissions: PermissionsByEntity = groupedPermissions.get(role) ?? new Map()
				groupedPermissions.set(role, rolePermissions)
				const entityPermissions = rolePermissions.get(name) ?? {
					definitions: [],
				}
				rolePermissions.set(name, entityPermissions)
				return entityPermissions
			}
			const metadata: EntityPermissionsDefinition[] = allowDefinitionsStore.get(entity)
			for (const { role, ...definition } of metadata) {
				if (!roles.includes(role)) {
					throw `Role ${role.name} used on entity ${name} is not registered. Have you exported it?`
				}
				const entityPermissions = initEntityPermissions(role)
				entityPermissions.definitions.push(definition)
			}
		}

		return groupedPermissions
	}
}


export type EntityPermissions = { definitions: AllowDefinition<any>[] }
export type PermissionsByEntity = Map<string, EntityPermissions>
export type PermissionsByRoleAndEntity = Map<Role, PermissionsByEntity>
