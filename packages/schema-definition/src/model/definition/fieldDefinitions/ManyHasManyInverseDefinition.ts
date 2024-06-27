import { Model } from '@contember/schema'
import { CreateFieldContext, FieldDefinition } from './FieldDefinition'
import { EntityConstructor, Interface, RelationTarget } from '../types'
import { ManyHasManyDefinition } from './ManyHasManyDefinition'

export class ManyHasManyInverseDefinitionImpl extends FieldDefinition<ManyHasManyInverseDefinitionOptions> {
	type = 'ManyHasManyInverseDefinition' as const

	orderBy(
		field: string | string[],
		direction: Model.OrderDirection | `${Model.OrderDirection}` = Model.OrderDirection.asc,
	): Interface<ManyHasManyInverseDefinition> {
		const path = typeof field === 'string' ? [field] : field
		return this.withOption('orderBy', [...(this.options.orderBy || []), { path, direction: direction as Model.OrderDirection }])
	}

	public description(description: string): Interface<ManyHasManyInverseDefinition> {
		return this.withOption('description', description)
	}

	createField({ name, conventions, entityName, entityRegistry }: CreateFieldContext): Model.AnyField {
		const options = this.options
		return {
			name: name,
			ownedBy: options.ownedBy,
			target: entityRegistry.getName(options.target),
			type: Model.RelationType.ManyHasMany,
			...(options.orderBy ? { orderBy: options.orderBy } : {}),
			...(options.description ? { description: options.description } : {}),
		}
	}
}

export type ManyHasManyInverseDefinition = Interface<ManyHasManyInverseDefinitionImpl>
/** @deprecated use ManyHasManyInverseDefinition */
export type ManyHasManyInversedDefinition = Interface<ManyHasManyInverseDefinitionImpl>

export function manyHasManyInverse(target: EntityConstructor, ownedBy: string): ManyHasManyInverseDefinition {
	return new ManyHasManyInverseDefinitionImpl({ target, ownedBy })
}

/** @deprecated use manyHasManyInverse */
export function manyHasManyInversed(target: EntityConstructor, ownedBy: string): ManyHasManyInverseDefinition {
	return new ManyHasManyInverseDefinitionImpl({ target, ownedBy })
}

export type ManyHasManyInverseDefinitionOptions = {
	target: RelationTarget
	ownedBy: string
	orderBy?: Model.OrderBy[]
	description?: string
}
