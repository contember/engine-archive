import { Acl } from '@contember/schema'
import { Role } from './roles'
import { VariableDefinition } from './variables'
import { PredicateEvaluationReference } from './references'
import { allowDefinitionsStore } from './internal/stores'
import { DecoratorFunction, EntityConstructor } from '../../utils'

export type PredicateExtra = PredicateEvaluationReference | VariableDefinition
export type WhenDefinition = Acl.PredicateDefinition<PredicateExtra>

export interface AllowDefinition<E> {
	when?: WhenDefinition
	through?: string[]
	name?: string
	create?: true | ('id' | keyof E)[]
	update?: true | ('id' | keyof E)[]
	read?: true | ('id' | keyof E)[]
	delete?: true
}

export const allow = <E, R extends Role<string>>(role: R | R[], args: AllowDefinition<E>): DecoratorFunction<E> => {
	return (entity: EntityConstructor<E>) => {
		(Array.isArray(role) ? role : [role]).forEach(role => {
			allowDefinitionsStore.update(entity, val => [...val, { ...args, role }])
		})
	}
}



