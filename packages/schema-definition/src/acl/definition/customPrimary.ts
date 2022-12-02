import { anyRole, Role } from './roles'
import { DecoratorFunction } from '../../model/definition/types'
import { extendEntityPermissions } from './extendEntityPermissions'

export const allowCustomPrimary = (roles: Role | Role[] | anyRole = anyRole): DecoratorFunction<any> => {
	return extendEntityPermissions(roles, ({ permissions }) => ({
		...permissions,
		operations: { ...permissions.operations, customPrimary: true },
	}))
}
