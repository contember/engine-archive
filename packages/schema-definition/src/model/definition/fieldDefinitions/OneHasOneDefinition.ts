import { Model } from '@contember/schema'
import { EntityConstructor, Interface, RelationTarget } from '../types'
import { CreateFieldContext, FieldDefinition } from './FieldDefinition'

export class OneHasOneDefinitionImpl extends FieldDefinition<OneHasOneDefinitionOptions> {
	type = 'OneHasOneDefinition' as const

	inversedBy(inversedBy: string): Interface<OneHasOneDefinition> {
		return this.withOption('inversedBy', inversedBy)
	}

	joiningColumn(columnName: string): Interface<OneHasOneDefinition> {
		return this.withOption('joiningColumn', { ...this.joiningColumn, columnName })
	}

	onDelete(onDelete: Model.OnDelete | `${Model.OnDelete}`): Interface<OneHasOneDefinition> {
		return this.withOption('joiningColumn', { ...this.joiningColumn, onDelete: onDelete as Model.OnDelete })
	}

	cascadeOnDelete(): Interface<OneHasOneDefinition> {
		return this.withOption('joiningColumn', { ...this.options.joiningColumn, onDelete: Model.OnDelete.cascade })
	}

	setNullOnDelete(): Interface<OneHasOneDefinition> {
		return this.withOption('joiningColumn', { ...this.options.joiningColumn, onDelete: Model.OnDelete.setNull })
	}

	restrictOnDelete(): Interface<OneHasOneDefinition> {
		return this.withOption('joiningColumn', { ...this.options.joiningColumn, onDelete: Model.OnDelete.restrict })
	}

	notNull(): Interface<OneHasOneDefinition> {
		return this.withOption('nullable', false)
	}

	removeOrphan(): Interface<OneHasOneDefinition> {
		return this.withOption('orphanRemoval', true)
	}

	public description(description: string): Interface<OneHasOneDefinition> {
		return this.withOption('description', description)
	}

	createField({ name, conventions, entityRegistry, strictDefinitionValidator, entityName }: CreateFieldContext): Model.AnyField {
		const options = this.options
		const joiningColumn: Partial<Model.JoiningColumn> = options.joiningColumn || {}

		strictDefinitionValidator.validateInverseSide(entityName, name, options)
		strictDefinitionValidator.validateOnCascade(entityName, name, joiningColumn)

		return {
			name: name,
			...(typeof options.inversedBy === 'undefined' ? {} : { inversedBy: options.inversedBy }),
			nullable: options.nullable === undefined ? true : options.nullable,
			type: Model.RelationType.OneHasOne,
			target: entityRegistry.getName(options.target),
			joiningColumn: {
				columnName: joiningColumn.columnName || conventions.getJoiningColumnName(name),
				onDelete: joiningColumn.onDelete || Model.OnDelete.restrict,
			},
			...(options.orphanRemoval ? { orphanRemoval: true } : {}),
			...(options.description ? { description: options.description } : {}),
		}
	}
}

export type OneHasOneDefinition = Interface<OneHasOneDefinitionImpl>

export function oneHasOne(target: EntityConstructor, inversedBy?: string): OneHasOneDefinition {
	return new OneHasOneDefinitionImpl({ target, inversedBy })
}

export type OneHasOneDefinitionOptions = {
	target: RelationTarget
	inversedBy?: string
	joiningColumn?: Partial<Model.JoiningColumn>
	nullable?: boolean
	orphanRemoval?: true
	description?: string
}
