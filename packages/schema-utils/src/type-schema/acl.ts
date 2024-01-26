import { Acl, Model } from '@contember/schema'
import * as Typesafe from '@contember/typesafe'
import { conditionSchema } from './condition'

const membershipMatchRuleSchema = Typesafe.record(
	Typesafe.string,
	Typesafe.union(
		Typesafe.literal(true),
		Typesafe.partial({
			variables: Typesafe.union(
				Typesafe.literal(true),
				Typesafe.record(
					Typesafe.string,
					Typesafe.union(Typesafe.literal(true), Typesafe.string),
				),
			),
		}),
	),
)

const tenantPermissionsSchema = Typesafe.partial({
	invite: Typesafe.union(Typesafe.boolean, membershipMatchRuleSchema),
	unmanagedInvite: Typesafe.union(Typesafe.boolean, membershipMatchRuleSchema),
	manage: membershipMatchRuleSchema,
	view: membershipMatchRuleSchema,
})
const tenantSchemaCheck: Typesafe.Equals<Acl.TenantPermissions, ReturnType<typeof tenantPermissionsSchema>> = true

const systemPermissionsSchema = Typesafe.partial({
	history: Typesafe.union(Typesafe.boolean, Typesafe.enumeration('any', 'none')),
	migrate: Typesafe.boolean,
	assumeIdentity: Typesafe.boolean,
	export: Typesafe.boolean,
	import: Typesafe.boolean,
})
const systemSchemaCheck: Typesafe.Equals<Acl.SystemPermissions, ReturnType<typeof systemPermissionsSchema>> = true

const contentPermissionsSchema = Typesafe.partial({
	assumeMembership: membershipMatchRuleSchema,
	export: Typesafe.boolean,
	import: Typesafe.boolean,
})
const contentSchemaCheck: Typesafe.Equals<Acl.ContentPermissions, ReturnType<typeof contentPermissionsSchema>> = true

const entityVariableSchema = Typesafe.intersection(
	Typesafe.object({
		type: Typesafe.literal(Acl.VariableType.entity),
		entityName: Typesafe.string,
	}),
	Typesafe.partial({
		fallback: conditionSchema(),
	}),
)
const entityVariableSchemaCheck: Typesafe.Equals<Acl.EntityVariable, ReturnType<typeof entityVariableSchema>> = true

const predefinedVariableSchema = Typesafe.object({
	type: Typesafe.literal(Acl.VariableType.predefined),
	value: Typesafe.enumeration('identityID', 'personID'),
})
const conditionVariableSchema = Typesafe.intersection(
	Typesafe.object({
		type: Typesafe.literal(Acl.VariableType.condition),
	}),
	Typesafe.partial({
		fallback: conditionSchema(),
	}),
)
const conditionVariableSchemaCheck: Typesafe.Equals<Acl.ConditionVariable, ReturnType<typeof conditionVariableSchema>> = true

const variablesSchema = Typesafe.record(
	Typesafe.string,
	Typesafe.union(
		entityVariableSchema as Typesafe.Type<Acl.EntityVariable>,
		predefinedVariableSchema,
		conditionVariableSchema as Typesafe.Type<Acl.ConditionVariable>,
	),
)

const variableSchemaCheck: Typesafe.Equals<Acl.Variables, ReturnType<typeof variablesSchema>> = true

const richPredicateSchema = Typesafe.intersection(
	Typesafe.object({
		predicate: Typesafe.union(Typesafe.string, Typesafe.literal(true)),
	}),
	Typesafe.partial({
		through: Typesafe.union(Typesafe.array(Typesafe.string), Typesafe.literal(true)),
	}),
)
const richPredicateSchemaCheck: Typesafe.Equals<Acl.RichPredicate, ReturnType<typeof richPredicateSchema>> = true

const predicateSchema = Typesafe.union(
	Typesafe.string,
	Typesafe.boolean,
	Typesafe.array<Acl.RichPredicate>(richPredicateSchema),
)
const predicateSchemaCheck: Typesafe.Equals<Acl.Predicate, ReturnType<typeof predicateSchema>> = true
const fieldPermissionsSchema = Typesafe.record(
	Typesafe.string,
	predicateSchema,
)

const predicatesSchema = Typesafe.record(
	Typesafe.string,
	(v, p): Acl.PredicateDefinition => Typesafe.anyJsonObject(v, p) as Acl.PredicateDefinition,
)

const predicatesSchemaCheck: Typesafe.Equals<Acl.PredicateMap, ReturnType<typeof predicatesSchema>> = true

const entityOperationsSchema = Typesafe.partial({
	read: fieldPermissionsSchema,
	create: fieldPermissionsSchema,
	update: fieldPermissionsSchema,
	delete: predicateSchema,
	customPrimary: Typesafe.boolean,
})
const opSchemaCheck: Typesafe.Equals<Acl.EntityOperations, ReturnType<typeof entityOperationsSchema>> = true
const entitiesSchema = Typesafe.record(
	Typesafe.string,
	Typesafe.object({
		predicates: predicatesSchema,
		operations: entityOperationsSchema,
	}),
)
const entitiesSchemaCheck: Typesafe.Equals<Acl.Permissions, ReturnType<typeof entitiesSchema>> = true

const baseRolePermissionsSchema = Typesafe.intersection(
	Typesafe.object({
		variables: variablesSchema,
		entities: entitiesSchema,
	}),
	Typesafe.partial({
		inherits: Typesafe.array(Typesafe.string),
		implicit: Typesafe.boolean,
		stages: Typesafe.union(
			Typesafe.literal('*'),
			Typesafe.array(Typesafe.string),
		),
		tenant: tenantPermissionsSchema,
		system: systemPermissionsSchema,
		content: contentPermissionsSchema,
		debug: Typesafe.boolean,
	}),
)
const baseRolePermissionsCheck: Typesafe.Equals<Acl.BaseRolePermissions, ReturnType<typeof baseRolePermissionsSchema>> = true

export const aclSchema = Typesafe.intersection(
	Typesafe.object({
		roles: Typesafe.record(
			Typesafe.string,
			(v, p): Acl.RolePermissions => {
				const main: Acl.BaseRolePermissions = baseRolePermissionsSchema(v, p)
				return {
					...(v as any),
					...main,
				}
			},
		),
	}),
	Typesafe.partial({
		customPrimary: Typesafe.boolean,
	}),
)
const aclSchemaCheck: Typesafe.Equals<Acl.Schema, ReturnType<typeof aclSchema>> = true
