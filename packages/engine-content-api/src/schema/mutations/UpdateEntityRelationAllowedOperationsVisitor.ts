import { Acl, Input, Model } from '@contember/schema'
import { Authorizator } from '../../acl'
import { isOwningRelation } from '@contember/schema-utils'

export class UpdateEntityRelationAllowedOperationsVisitor implements
	Model.ColumnVisitor<never>,
	Model.RelationByTypeVisitor<Input.UpdateRelationOperation[]> {

	constructor(private readonly authorizator: Authorizator) {}

	visitColumn(): never {
		throw new Error('UpdateEntityRelationAllowedOperationsVisitor: Not applicable for a column')
	}

	public visitManyHasManyInverse(ctx: Model.ManyHasManyInverseContext) {
		return this.getAllowedOperations(ctx)
	}

	public visitManyHasManyOwning(ctx: Model.ManyHasManyOwningContext) {
		return this.getAllowedOperations(ctx)
	}

	public visitOneHasMany(ctx: Model.OneHasManyContext) {
		return this.getAllowedOperations(ctx)
	}

	public visitManyHasOne(ctx: Model.ManyHasOneContext) {
		const operations = this.getAllowedOperations(ctx)
		const { relation } = ctx
		if (relation.nullable) {
			return operations
		}
		const forbiddenOperations = [Input.UpdateRelationOperation.disconnect]
		if (relation.joiningColumn.onDelete !== Model.OnDelete.cascade) {
			forbiddenOperations.push(Input.UpdateRelationOperation.delete)
		}
		return operations.filter(it => !forbiddenOperations.includes(it))
	}

	public visitOneHasOneInverse(ctx: Model.OneHasOneInverseContext) {
		const operations = this.getAllowedOperations(ctx)
		const { relation, targetRelation } = ctx
		if (relation.nullable || targetRelation.nullable) {
			return operations
		}
		return operations.filter(it => it === Input.UpdateRelationOperation.update)
	}

	public visitOneHasOneOwning(ctx: Model.OneHasOneOwningContext) {
		const operations = this.getAllowedOperations(ctx)
		const { relation, targetRelation } = ctx
		if (relation.nullable || !targetRelation || targetRelation.nullable) {
			return operations
		}
		const allowedOperations = [Input.UpdateRelationOperation.update]
		if (relation.joiningColumn.onDelete === Model.OnDelete.cascade) {
			allowedOperations.push(Input.UpdateRelationOperation.delete)
		}
		return operations.filter(it => allowedOperations.includes(it))
	}

	private getAllowedOperations(
		ctx: Model.AnyRelationContext,
	): Input.UpdateRelationOperation[] {
		const result: Input.UpdateRelationOperation[] = []
		const { relation, entity, targetEntity, targetRelation } = ctx

		const [owningEntity, owningRelation] = isOwningRelation(relation) ? [entity, relation] : [targetEntity, targetRelation]
		if (!owningRelation) {
			throw new Error()
		}

		const canReadTargetEntity = this.authorizator.getEntityPermission(Acl.Operation.read, targetEntity.name) !== 'no'
		const canCreateTargetEntity = this.authorizator.getEntityPermission(Acl.Operation.create, targetEntity.name) !== 'no'
		const canUpdateTargetEntity = this.authorizator.getEntityPermission(Acl.Operation.update, targetEntity.name) !== 'no'
		const canDeleteTargetEntity = this.authorizator.getEntityPermission(Acl.Operation.delete, targetEntity.name) !== 'no'
		const canUpdateOwningRelation = this.authorizator.getFieldPermissions(Acl.Operation.update, owningEntity.name, owningRelation.name) !== 'no'

		if (canReadTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.connect)
			result.push(Input.UpdateRelationOperation.disconnect)
		}

		if (canCreateTargetEntity) {
			result.push(Input.UpdateRelationOperation.create)
		}

		if (canUpdateTargetEntity) {
			result.push(Input.UpdateRelationOperation.update)
		}

		if (canCreateTargetEntity && canUpdateTargetEntity) {
			result.push(Input.UpdateRelationOperation.upsert)
		}
		if (canDeleteTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.delete)
		}

		return result
	}
}
