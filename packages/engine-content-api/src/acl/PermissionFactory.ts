import { Acl, Model, Schema } from '@contember/schema'
import { getEntity, PredicateDefinitionProcessor } from '@contember/schema-utils'
import { mapObject } from '../utils'
import { prefixVariable } from './VariableUtils'
import {
	ResolvedEntityOperations,
	ResolvedEntityPermissions,
	ResolvedFieldPermissions,
	Permissions,
	ResolvedPredicates,
	ThroughAnyRelation,
	ThroughRoot, ThroughUnknown, ResolvedPermissions, PermissionsThroughKey,
} from './Permissions'

export interface Identity {
	projectRoles: readonly string[]
}

export class PermissionFactory {
	public create(schema: Schema, roles: readonly string[], prefix?: string): ResolvedPermissions {
		let result: ResolvedPermissions = {}
		for (let role of roles) {
			const roleDefinition = schema.acl.roles[role] || { entities: {} }
			const prefixedVariables = this.prefixPredicateVariables(schema.model, roleDefinition.entities, prefix || role)
			result = this.mergePermissions(result, this.resolvePredicates(schema.model, prefixedVariables))
			if (roleDefinition.inherits) {
				const inheritedPermissions = this.create(schema, roleDefinition.inherits, prefix || role)
				result = this.mergePermissions(result, inheritedPermissions)
			}
		}
		result = this.makePrimaryPredicatesUnionOfAllFields(schema.model, result)

		return result
	}

	private prefixPredicateVariables(model: Model.Schema, permissions: Acl.Permissions, role: string): Acl.Permissions {
		return mapObject(permissions, ({ operations, predicates }, entityName) => ({
			operations,
			predicates: mapObject(predicates, predicate => {
				const predicateDefinitionProcessor = new PredicateDefinitionProcessor(model)
				return predicateDefinitionProcessor.process(getEntity(model, entityName), predicate, {
					handleColumn: ({ value }) => {
						if (typeof value === 'string') {
							return prefixVariable(role, value)
						}
						return value
					},
					handleRelation: ({ value }) => {
						if (typeof value === 'string') {
							return prefixVariable(role, value)
						}
						return value
					},
				})
			}),
		}))
	}

	private resolvePredicates(model: Model.Schema, permissions: Acl.Permissions): ResolvedPermissions {
		return mapObject(permissions, (entityPermissions, entityName): ResolvedEntityPermissions => {
			const resolvedOperations: ResolvedEntityOperations = {}

			if (entityPermissions.operations.customPrimary) {
				resolvedOperations.customPrimary = true
			}

			const operationNames = ['read', 'create', 'update'] as const
			for (let operation of operationNames) {
				const operations = entityPermissions.operations[operation]
				if (!operations) {
					continue
				}
				const fieldPermissions: ResolvedFieldPermissions = {}

				for (let field in operations) {
					const fieldPermission = operations[field]
					const resolvedFieldPermissions = this.resolvePredicate(entityPermissions.predicates, fieldPermission)
					fieldPermissions[field] = resolvedFieldPermissions
				}
				resolvedOperations[operation] = fieldPermissions
			}

			const deletePermission = entityPermissions.operations.delete
			if (deletePermission) {
				const resolvedDeletePredicate = this.resolvePredicate(entityPermissions.predicates, deletePermission)
				resolvedOperations.delete = resolvedDeletePredicate
			}

			return {
				operations: resolvedOperations,
			}
		})
	}

	private resolvePredicate(predicates: Acl.PredicateMap, predicate: Acl.Predicate): ResolvedPredicates {
		if (typeof predicate === 'string') {
			return {
				[ThroughRoot]: [predicates[predicate]],
			}
		} else if (predicate === true) {
			return { [ThroughRoot]: true }
		} else if (predicate) {
			const resolvedPredicates: ResolvedPredicates = {}
			for (const richPredicate of predicate) {
				const through = (!richPredicate.through
					? [ThroughRoot]
					: richPredicate.through === true ? [ThroughAnyRelation] : richPredicate.through) as PermissionsThroughKey[]

				for (const throughRelation of through) {
					const thisPredicates = resolvedPredicates[throughRelation] ?? []
					if (thisPredicates === true) {
						continue
					}
					if (richPredicate.predicate === true) {
						resolvedPredicates[throughRelation] = true
					} else if (typeof richPredicate.predicate === 'string') {
						resolvedPredicates[throughRelation] = thisPredicates
						thisPredicates.push(predicates[richPredicate.predicate])
					}
				}
			}

			return resolvedPredicates
		}
		return {}
	}

	private makePrimaryPredicatesUnionOfAllFields(model: Model.Schema, permissions: ResolvedPermissions): ResolvedPermissions {
		return mapObject(permissions, (permission, entityName): ResolvedEntityPermissions => {
			const entity = getEntity(model, entityName)
			const entityOperations: ResolvedEntityOperations = { ...permission.operations }

			const operationNames = ['read', 'create', 'update'] as const
			for (let operation of operationNames) {
				if (!entityOperations[operation]) {
					continue
				}
				const fieldPermissions: ResolvedFieldPermissions = { ...entityOperations[operation] }
				entityOperations[operation] = fieldPermissions

				let idPermissions: ResolvedPredicates = {}

				for (const field of Object.values(fieldPermissions)) {
					idPermissions = this.mergePredicates(idPermissions, field)
				}
				fieldPermissions[entity.primary] = idPermissions
			}
			return {
				operations: entityOperations,
			}
		})
	}

	private mergePermissions(left: ResolvedPermissions, right: ResolvedPermissions): ResolvedPermissions {
		const result = { ...left }
		for (let entityName in right) {
			if (result[entityName] !== undefined) {
				result[entityName] = this.mergeEntityPermissions(result[entityName], right[entityName])
			} else {
				result[entityName] = right[entityName]
			}
		}
		return result
	}

	private mergeEntityPermissions(left: ResolvedEntityPermissions, right: ResolvedEntityPermissions): ResolvedEntityPermissions {
		const operations: ResolvedEntityOperations = {}
		if (left.operations.customPrimary || right.operations.customPrimary) {
			operations.customPrimary = true
		}

		const operationNames = ['create', 'read', 'update'] as const

		for (let operation of operationNames) {
			const leftFieldPermissions = left.operations[operation] || {}
			const rightFieldPermissions = right.operations[operation] || {}

			const fieldPermissions = this.mergeFieldPermissions(
				leftFieldPermissions,
				rightFieldPermissions,
			)
			if (Object.keys(fieldPermissions).length > 0) {
				operations[operation] = fieldPermissions
			}
		}

		const predicate = this.mergePredicates(
			left.operations.delete || {},
			right.operations.delete || {},
		)
		operations.delete = predicate

		return {
			operations: operations,
		}
	}

	private mergeFieldPermissions(
		leftFieldPermissions: ResolvedFieldPermissions,
		rightFieldPermissions: ResolvedFieldPermissions,
	): ResolvedFieldPermissions {
		const fields: ResolvedFieldPermissions = {}

		for (let field in { ...leftFieldPermissions, ...rightFieldPermissions }) {
			const predicates = this.mergePredicates(
				leftFieldPermissions[field] ?? [],
				rightFieldPermissions[field] ?? [],
			)
			fields[field] = predicates
		}

		return fields
	}

	private mergePredicates(
		leftPredicates: ResolvedPredicates,
		rightPredicates: ResolvedPredicates,
	): ResolvedPredicates {
		const newPredicates: ResolvedPredicates = { ...leftPredicates }

		for (const [rightPredicateKey, rightPredicate] of Object.entries(rightPredicates)) {
			if (!rightPredicate) {
				continue
			}
			const leftPredicate = leftPredicates[rightPredicateKey]
			if (leftPredicate === true || rightPredicate === true) {
				newPredicates[rightPredicateKey] = true
				newPredicates[ThroughUnknown] = true
				continue
			}

			const newMissingPredicates = rightPredicate.filter(it => !leftPredicate?.includes(it))
			newPredicates[rightPredicateKey] = [...(leftPredicate ?? []), ...newMissingPredicates]
		}

		if (newPredicates[ThroughUnknown] !== true) {
			for (const newPredicate of Object.values(newPredicates)) {
				if (newPredicate === true || newPredicate === undefined) {
					continue
				}
				const unknownPredicates = (newPredicates[ThroughUnknown] ??= []) as Acl.PredicateDefinition[]
				const newMissingPredicates = newPredicate.filter(it => !unknownPredicates.includes(it))
				unknownPredicates.push(...newMissingPredicates)
			}
		}

		return newPredicates
	}
}
