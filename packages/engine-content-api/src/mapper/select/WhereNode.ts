import { Input, Model } from '@contember/schema'

export type WhereMultiOpNode = {
	type: 'multiOp'
	operator: 'and' | 'or'
	nodes: WhereNode[]
}

export type WhereUnaryOpNode = {
	type: 'unaryOp'
	operator: 'not'
	node: WhereNode
}

export type WhereRelationNode = {
	type: 'path'
	name: string
	entity: Model.Entity
	field: Model.AnyRelation
	node: WhereNode
}

export type WhereFieldNode = {
	type: 'field'
	name: string
	entity: Model.Entity
	field: Model.AnyColumn
	condition: ConditionNode
}

export type ConditionMultiOpNode = {
	type: 'conditionMultiOp'
	operator: 'and' | 'or'
	nodes: ConditionNode[]
}

export type ConditionUnaryOpNode = {
	type: 'conditionUnaryOp'
	operator: 'and' | 'or'
	node: ConditionNode
}


type LeafConditionOps = {
	[K in keyof Input.LeafCondition]: {
		op: K
		value: Input.LeafCondition[K]
	}
}[Exclude<keyof Input.LeafCondition, 'null'>]

export type ConditionLeafOpNode = {
	type: 'leafOp'
} & LeafConditionOps


export type WhereNode =
	| WhereMultiOpNode
	| WhereUnaryOpNode
	| WhereRelationNode
	| WhereFieldNode

export type ConditionNode =
	| ConditionMultiOpNode
	| ConditionUnaryOpNode
	| ConditionLeafOpNode

export const createWhereAst = ({ schema, where, entity }: { schema: Model.Schema; entity: Model.Entity; where: Input.OptionalWhere }): WhereNode => {
	const operands: WhereNode[] = []
	for (const field in where) {
		if (where[field] === null || where[field] === undefined) {
			continue
		}
		if (field === 'and') {
			operands.push(...where[field]!.flatMap(it => {
				if (it === null || it === undefined) {
					return []
				}
				return [createWhereAst({ schema, entity, where: it })]
			}))
		}
	}

	if (operands.length === 1) {
		return operands[0]
	}
	return {
		type: 'multiOp',
		operator: 'and',
		nodes: operands,
	}
}
