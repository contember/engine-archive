import { Acl, Input, Model } from '@contember/schema'
import { Permissions, ThroughAnyRelation } from '../../acl'

export class UpdateEntityRelationAllowedOperationsVisitor implements
	Model.ColumnVisitor<never>,
	Model.RelationByTypeVisitor<Input.UpdateRelationOperation[]> {

	constructor(
		private readonly permissions: Permissions,
	) {}

	visitColumn(): never {
		throw new Error('UpdateEntityRelationAllowedOperationsVisitor: Not applicable for a column')
	}

	public visitManyHasManyInverse({ targetEntity, targetRelation }: Model.ManyHasManyInverseContext) {
		return this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
	}

	public visitManyHasManyOwning({ entity, targetEntity, relation, targetRelation }: Model.ManyHasManyOwningContext) {
		return this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
	}

	public visitOneHasMany({ targetRelation, targetEntity }: Model.OneHasManyContext) {
		return this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
	}

	public visitManyHasOne({ targetEntity, relation, entity, targetRelation }: Model.ManyHasOneContext) {
		const operations = this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
		if (relation.nullable) {
			return operations
		}
		const forbiddenOperations = [Input.UpdateRelationOperation.disconnect]
		if (relation.joiningColumn.onDelete !== Model.OnDelete.cascade) {
			forbiddenOperations.push(Input.UpdateRelationOperation.delete)
		}
		return operations.filter(it => !forbiddenOperations.includes(it))
	}

	public visitOneHasOneInverse({ relation, targetEntity, targetRelation }: Model.OneHasOneInverseContext) {
		const operations = this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
		if (relation.nullable || targetRelation.nullable) {
			return operations
		}
		return operations.filter(it => it === Input.UpdateRelationOperation.update)
	}

	public visitOneHasOneOwning({ targetEntity, entity, relation, targetRelation }: Model.OneHasOneOwningContext) {
		const operations = this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
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
		targetEntity: Model.Entity,
		owningEntity: Model.Entity,
		owningRelation: Model.Relation,
		targetRelation: Model.Relation | null,
	): Input.UpdateRelationOperation[] {
		const result: Input.UpdateRelationOperation[] = []

		const through = targetRelation?.name ?? ThroughAnyRelation
		const canReadTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.read, entity: targetEntity.name, through })
		const canCreateTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.create, entity: targetEntity.name, through })
		const canUpdateTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.update, entity: targetEntity.name, through })
		const canDeleteTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.delete, entity: targetEntity.name, through })
		const canUpdateOwningRelation = this.permissions.canPossiblyAccessField({ operation: Acl.Operation.update, entity: owningEntity.name, field: owningRelation.name, through })

		if (canReadTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.connect)
			result.push(Input.UpdateRelationOperation.disconnect)
		}
		if (canCreateTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.create)
		}
		if (canUpdateTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.update)
		}
		if (canCreateTargetEntity && canUpdateTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.upsert)
		}
		if (canDeleteTargetEntity && canUpdateOwningRelation) {
			result.push(Input.UpdateRelationOperation.delete)
		}
		if (canReadTargetEntity && canUpdateOwningRelation && canCreateTargetEntity) {
			result.push(Input.UpdateRelationOperation.connectOrCreate)
		}

		return result
	}
}
