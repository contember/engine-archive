import { GraphQLList, GraphQLNonNull, GraphQLOutputType } from 'graphql'
import { Acl, Model } from '@contember/schema'
import { ColumnTypeResolver } from '../ColumnTypeResolver'
import { EntityTypeProvider } from '../EntityTypeProvider'
import { Permissions, ThroughUnknown } from '../../acl'

export class FieldTypeVisitor implements Model.ColumnVisitor<GraphQLOutputType>, Model.RelationByGenericTypeVisitor<GraphQLOutputType> {
	constructor(
		private readonly columnTypeResolver: ColumnTypeResolver,
		private readonly entityTypeProvider: EntityTypeProvider,
		private readonly permissions: Permissions,
	) {
	}

	public visitColumn({ column, entity }: Model.ColumnContext): GraphQLOutputType {
		const basicType = this.columnTypeResolver.getType(column)

		const differentPredicate = this.permissions.doesFieldHasExtraPredicates({
			operation: Acl.Operation.read,
			entity: entity.name,
			field: column.name,
			through: ThroughUnknown,
		})

		if (!column.nullable && differentPredicate) {
			return new GraphQLNonNull(basicType)
		}
		return basicType
	}

	public visitHasMany({ relation }: Model.AnyHasManyRelationContext): GraphQLOutputType {
		const entityType = this.entityTypeProvider.getEntity(relation.target)
		return new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(entityType)))
	}

	public visitHasOne({ relation }: Model.AnyHasOneRelationContext): GraphQLOutputType {
		return this.entityTypeProvider.getEntity(relation.target)
	}
}
