import { Acl, Model } from '@contember/schema'
import { EntityConstructor } from '../../model/definition/types'
import { RolesReference } from './roles'
import { entityPermissionsExtensionStore } from './internal/stores'

export interface EntityPermissionsExtensionArgs {
	permissions: Acl.EntityPermissions
	entity: Model.Entity
}

export type EntityPermissionsExtension = (args: EntityPermissionsExtensionArgs) => Acl.EntityPermissions

export const extendEntityPermissions = (roles: RolesReference, extension: EntityPermissionsExtension) => {
	return (entity: EntityConstructor) => {
		entityPermissionsExtensionStore.update(it => [...it, { extension, roles }], entity)
	}
}
