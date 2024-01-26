import { Acl, Input, Model } from '@contember/schema'
import { ImplementationException } from '../../exception'
import { Permissions, ThroughAnyRelation } from '../../acl'

export class CreateEntityRelationAllowedOperationsVisitor implements
	Model.ColumnVisitor<never>,
	Model.RelationByTypeVisitor<Input.CreateRelationOperation[]> {

	constructor(
		private readonly permissions: Permissions,
	) {}

	visitColumn(): never {
		throw new ImplementationException('CreateEntityRelationAllowedOperationsVisitor: Not applicable for a column')
	}

	public visitManyHasManyInverse({ targetEntity, targetRelation }: Model.ManyHasManyInverseContext) {
		return this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
	}

	public visitManyHasManyOwning({ entity, targetEntity, relation, targetRelation }: Model.ManyHasManyOwningContext) {
		return this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
	}

	public visitOneHasMany({ targetEntity, targetRelation  }: Model.OneHasManyContext) {
		return this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
	}

	public visitManyHasOne({ targetEntity, entity, relation, targetRelation }: Model.ManyHasOneContext) {
		return this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
	}

	public visitOneHasOneInverse({ targetEntity, targetRelation, relation }: Model.OneHasOneInverseContext) {
		const operations = this.getAllowedOperations(targetEntity, targetEntity, targetRelation, targetRelation)
		if (relation.nullable || targetRelation.nullable) {
			return operations
		}
		return operations.filter(it => it === Input.CreateRelationOperation.create)
	}

	public visitOneHasOneOwning({ targetEntity, entity, relation, targetRelation }: Model.OneHasOneOwningContext) {
		const operations = this.getAllowedOperations(targetEntity, entity, relation, targetRelation)
		if (!targetRelation || targetRelation.nullable || relation.nullable) {
			return operations
		}
		return operations.filter(it => it === Input.CreateRelationOperation.create)
	}

	private getAllowedOperations(
		targetEntity: Model.Entity,
		owningEntity: Model.Entity,
		owningRelation: Model.Relation,
		targetRelation: Model.Relation | null,
	): Input.CreateRelationOperation[] {
		const result: Input.CreateRelationOperation[] = []

		const through = targetRelation?.name ?? ThroughAnyRelation
		const canReadTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.read, entity: targetEntity.name, through })
		const canCreateTargetEntity = this.permissions.canPossiblyAccessEntity({ operation: Acl.Operation.create, entity: targetEntity.name, through })
		const canCreateOwning = this.permissions.canPossiblyAccessField({ operation: Acl.Operation.create, entity: owningEntity.name, field: owningRelation.name, through })

		if (canReadTargetEntity && canCreateOwning) {
			result.push(Input.CreateRelationOperation.connect)
		}
		if (canCreateTargetEntity && canCreateOwning) {
			result.push(Input.CreateRelationOperation.create)
		}
		if (canReadTargetEntity && canCreateTargetEntity && canCreateOwning) {
			result.push(Input.CreateRelationOperation.connectOrCreate)
		}

		return result
	}
}
