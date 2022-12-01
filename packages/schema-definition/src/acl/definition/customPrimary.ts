import { Role } from './roles'
import { allowCustomPrimaryAllRolesStore, allowCustomPrimaryStore } from './internal/stores'
import { DecoratorFunction, EntityConstructor } from '../../model/definition/types'

export const allowCustomPrimary = (role?: Role | Role[]): DecoratorFunction<any> => {
	return (entity: EntityConstructor) => {
		if (!role) {
			allowCustomPrimaryAllRolesStore.update(() => true, entity)
		} else {
			const roleArr = Array.isArray(role) ? role : [role]
			allowCustomPrimaryStore.update(val => [...val, ...roleArr], entity)
		}
	}
}
