import { Acl, Model } from '@contember/schema'

export type ResolvedPermissions = {
	[entity: string]: ResolvedEntityPermissions
}

export type ResolvedEntityPermissions = {
	operations: ResolvedEntityOperations
}

export type ResolvedEntityOperations = {
	read?: ResolvedFieldPermissions
	create?: ResolvedFieldPermissions
	update?: ResolvedFieldPermissions
	delete?: ResolvedPredicates
	customPrimary?: boolean
}

export type ResolvedFieldPermissions = { [field: string]: ResolvedPredicates }

export const ThroughAnyRelation = Symbol('ThroughAnyRelation')
export const ThroughRoot = Symbol('ThroughRoot')
export const ThroughUnknown = Symbol('ThroughUnknown')

export type ResolvedPredicateValue = true | Acl.PredicateDefinition[]

export type PermissionsThroughKey =
	| typeof ThroughAnyRelation
	| typeof ThroughRoot
	| typeof ThroughUnknown
	| string

export type ResolvedPredicates = {
	[K in PermissionsThroughKey]?: ResolvedPredicateValue
}


export type FieldLevelOperations = Acl.Operation.create | Acl.Operation.read | Acl.Operation.update

export type EntityLevelAccessSpecification = { operation: Acl.Operation; entity: string; through: PermissionsThroughKey }

export type FieldLevelAccessSpecification = { operation: FieldLevelOperations; entity: string; field: string; through: PermissionsThroughKey }

export class Permissions {
	constructor(
		private readonly model: Model.Schema,
		private readonly permissions: ResolvedPermissions,
		private readonly defaultCustomPrimary: boolean,
	) {
	}

	canPossiblyAccessEntity({ operation, entity, through }: EntityLevelAccessSpecification): boolean {
		if (!this.permissions[entity]) {
			return false
		}
		const entityPermissions = this.permissions[entity]

		if (operation === Acl.Operation.delete) {
			return !!this.getMatchingPredicates(through, entityPermissions.operations.delete)
		}
		const fieldPermissions = entityPermissions.operations[operation]
		if (!fieldPermissions) {
			return false
		}
		for (const field in fieldPermissions) {
			const fieldPermission = fieldPermissions[field]
			if (this.getMatchingPredicates(through, fieldPermission)) {
				return true
			}
		}
		return false
	}

	getEntityPredicate({ operation, entity: entityName, through }: EntityLevelAccessSpecification): false | ResolvedPredicateValue {
		const entityPermissions = this.permissions[entityName]
		if (!entityPermissions) {
			return false
		}
		if (operation === Acl.Operation.delete) {
			return !!this.getMatchingPredicates(through, entityPermissions.operations.delete)
		}
		const fieldPermissions = entityPermissions.operations[operation]
		if (!fieldPermissions) {
			return false
		}
		const entity = this.model.entities[entityName]
		const fieldPermission = fieldPermissions[entity.primary]
		return this.getMatchingPredicates(through, fieldPermission)
	}

	canPossiblyAccessField({ operation, entity, field, through }: FieldLevelAccessSpecification): boolean {
		return !!this.getFieldPredicate({ operation, entity, field, through })
	}

	getFieldPredicate({ operation, entity: entityName, field, through }: FieldLevelAccessSpecification & { ifExtra?: boolean }): false | ResolvedPredicateValue {
		const entityOperations = this.permissions[entityName]?.operations[operation]
		const predicate = entityOperations?.[field]
		if (!predicate) {
			return false
		}

		const fieldPredicates = this.getMatchingPredicates(through, predicate)
		if (typeof fieldPredicates === 'boolean') {
			return fieldPredicates
		}
		const entity = this.model.entities[entityName]
		const primaryPredicate = this.getMatchingPredicates(through, entityOperations?.[entity.primary])
		if (typeof primaryPredicate === 'boolean') {
			return fieldPredicates
		}
		if (fieldPredicates.every(it => primaryPredicate.includes(it))) {
			return true
		}

		return fieldPredicates
	}

	doesFieldHasExtraPredicates({ operation, entity: entityName, field, through }: FieldLevelAccessSpecification): boolean {
		const entityOperations = this.permissions[entityName]?.operations[operation]
		const thisPredicate = this.getMatchingPredicates(through, entityOperations?.[field])
		const entity = this.model.entities[entityName]
		const primaryPredicate = this.getMatchingPredicates(through, entityOperations?.[entity.primary])
		if (thisPredicate === primaryPredicate) {
			return false
		}
		if (typeof primaryPredicate === 'boolean' || typeof thisPredicate === 'boolean') {
			return true
		}
		return !thisPredicate.every(it => primaryPredicate.includes(it))
	}


	isCustomPrimaryAllowed(entity: string): boolean {
		return this.permissions?.[entity]?.operations?.customPrimary ?? this.defaultCustomPrimary
	}

	private getMatchingPredicates(key: PermissionsThroughKey, predicates: undefined | ResolvedPredicates): false | ResolvedPredicateValue {
		if (!predicates) {
			return false
		}
		if (key === ThroughRoot) {
			return predicates[ThroughRoot] ?? false
		}

		if (key === ThroughUnknown) {
			return predicates[ThroughUnknown] ?? false
		}

		if (typeof key === 'string') {
			const matching = predicates[key]
			if (matching) {
				return matching
			}
		}

		return predicates[ThroughAnyRelation] ?? predicates[ThroughRoot] ?? false
	}
}
