import { Path } from './Path'
import { Acl, Input, Model } from '@contember/schema'
import { ColumnValueGetter, SelectNestedData, SelectNestedDefaultValue, SelectRow } from './SelectHydrator'
import { SelectBuilder } from '@contember/database'
import { Mapper } from '../Mapper'
import { FieldNode, ObjectNode } from '../../inputProcessing'
import { PermissionsThroughKey } from '../../acl'

export interface SelectExecutionHandler<
	FieldArgs = unknown,
	FieldExtensions extends Record<string, any> = Record<string, any>,
> {
	process(context: SelectExecutionHandlerContext<FieldArgs, FieldExtensions>): void
}

export type DataCallback = (ids: Input.PrimaryValue[]) => Promise<SelectNestedData>

export type SelectExecutionHandlerContext<
	FieldArgs = any,
	FieldExtensions extends Record<string, any> = Record<string, any>,
> = {
	mapper: Mapper
	path: Path
	entity: Model.Entity
	relationPath: Model.AnyRelationContext[]
	through: PermissionsThroughKey
	addPredicate: (predicate: boolean | Acl.PredicateDefinition[]) => (row: SelectRow) => boolean
	addColumn: (args: {
		predicate?: boolean | Acl.PredicateDefinition[]
		query?: (qb: SelectBuilder<SelectBuilder.Result>) => SelectBuilder<SelectBuilder.Result>
		path?: Path
		valueGetter?: ColumnValueGetter
	}) => void
	addData: (args: {
		field: string
		dataProvider: DataCallback
		predicate?: boolean | Acl.PredicateDefinition[]
		defaultValue?: SelectNestedDefaultValue
	}) => void
} & (
	| {
		fieldNode: FieldNode<FieldExtensions>
		objectNode?: never
	  }
	| {
		fieldNode?: never
		objectNode: ObjectNode<FieldArgs, FieldExtensions>
	  }
)
