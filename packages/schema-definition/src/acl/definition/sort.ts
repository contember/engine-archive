import { RolesReference } from './roles'
import { extendEntityPermissions } from './extendEntityPermissions'

export const sortable = (role: RolesReference, fields: string[]) => {
	return extendEntityPermissions(role, ({ permissions }) => {
		return ({
			...permissions,
			operations: {
				...permissions.operations,
				sort: Object.fromEntries((fields).map(it => [it, true])),
			},
		})
	})
}
