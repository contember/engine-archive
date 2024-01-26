import { Acl, Model } from '@contember/schema'
import { Permissions, ThroughUnknown } from '../acl'

export class FieldAccessVisitor implements Model.ColumnVisitor<boolean>, Model.RelationVisitor<boolean> {
	constructor(
		private readonly operation: Acl.Operation.create | Acl.Operation.read | Acl.Operation.update,
		private readonly permissions: Permissions,
		// todo: not sure if it does not require specific ThroughRelation per use case
	) {}

	visitColumn({ column, entity }: Model.ColumnContext) {
		return this.permissions.canPossiblyAccessField({
			operation: this.operation,
			entity: entity.name,
			field: column.name,
			through: ThroughUnknown,
		})
	}

	visitRelation({ targetEntity }: Model.AnyRelationContext) {
		return this.permissions.canPossiblyAccessEntity({
			operation: this.operation,
			entity: targetEntity.name,
			through: ThroughUnknown,
		})
	}
}
