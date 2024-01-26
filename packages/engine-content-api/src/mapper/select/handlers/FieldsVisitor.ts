import { Acl, Input, Model, Settings } from '@contember/schema'
import { Mapper } from '../../Mapper'
import { RelationFetcher } from '../RelationFetcher'
import { SelectExecutionHandlerContext } from '../SelectExecutionHandler'
import { Permissions, PredicateFactory } from '../../../acl'
import { Literal, wrapIdentifier } from '@contember/database'

export class FieldsVisitor implements Model.RelationByTypeVisitor<void>, Model.ColumnVisitor<void> {
	constructor(
		private readonly relationFetcher: RelationFetcher,
		private readonly permissions: Permissions,
		private readonly mapper: Mapper,
		private readonly executionContext: SelectExecutionHandlerContext,
		private readonly relationPath: Model.AnyRelationContext[],
		private readonly settings: Settings.ContentSettings,
	) {}

	visitColumn({ entity, column }: Model.ColumnContext): void {
		const columnPath = this.executionContext.path
		const tableAlias = columnPath.back().alias
		const columnAlias = columnPath.alias

		let selectFrom = wrapIdentifier(tableAlias) + '.' + wrapIdentifier(column.columnName)
		if (column.type === Model.ColumnType.Date && this.settings.shortDateResponse) {
			selectFrom += '::text'
		}

		this.executionContext.addColumn({
			query: qb => qb.select(new Literal(selectFrom), columnAlias),
			predicate: this.getRequiredPredicate(entity, column),
		})
	}

	public visitManyHasManyInverse(relationContext: Model.ManyHasManyInverseContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}
		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchManyHasManyGroups({
					mapper: this.mapper,
					field: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitManyHasManyOwning(relationContext: Model.ManyHasManyOwningContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}

		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchManyHasManyGroups({
					mapper: this.mapper,
					field: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasMany(relationContext: Model.OneHasManyContext): void {
		const field = this.executionContext.objectNode
		if (!field) {
			throw new Error()
		}

		this.executionContext.addData({
			field: relationContext.entity.primary,
			dataProvider: async ids =>
				this.relationFetcher.fetchOneHasManyGroups({
					mapper: this.mapper,
					objectNode: field,
					relationContext,
					relationPath: this.relationPath,
					ids: ids,
				}),
			defaultValue: [],
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasOneInverse(relationContext: Model.OneHasOneInverseContext): void {
		const { entity, targetRelation, targetEntity } = relationContext
		this.executionContext.addData({
			field: entity.primary,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetRelation.name]: {
						[entity.primary]: {
							in: ids,
						},
					},
				}
				const field = this.executionContext.objectNode
				if (!field) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, field.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = field.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetRelation.name)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitOneHasOneOwning(relationContext: Model.OneHasOneOwningContext): void {
		const { relation, targetEntity } = relationContext
		this.executionContext.addData({
			field: relation.name,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetEntity.primary]: {
						in: ids,
					},
				}
				const objectNode = this.executionContext.objectNode
				if (!objectNode) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, objectNode.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = objectNode.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetEntity.primary)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	public visitManyHasOne(relationContext: Model.ManyHasOneContext): void {
		const { relation, targetEntity } = relationContext
		this.executionContext.addData({
			field: relation.name,
			dataProvider: async ids => {
				const idsWhere: Input.Where = {
					[targetEntity.primary]: {
						in: ids,
					},
				}
				const objectNode = this.executionContext.objectNode
				if (!objectNode) {
					throw new Error()
				}
				const where: Input.Where = {
					and: [idsWhere, objectNode.args.filter].filter((it): it is Input.Where => it !== undefined),
				}
				const objectWithWhere = objectNode.withArg('filter', where)

				return this.mapper.selectAssoc(targetEntity, objectWithWhere, [
					...this.relationPath,
					relationContext,
				], targetEntity.primary)
			},
			defaultValue: null,
			predicate: this.getRequiredPredicate(relationContext.entity, relationContext.relation),
		})
	}

	private getRequiredPredicate(entity: Model.Entity, field: Model.AnyField): boolean | Acl.PredicateDefinition[] {
		return this.permissions.getFieldPredicate({
			operation: Acl.Operation.read,
			entity: entity.name,
			field: field.name,
			through: this.executionContext.through,
			ifExtra: true,
		})
	}
}
