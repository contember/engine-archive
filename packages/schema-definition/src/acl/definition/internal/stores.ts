import { createMetadataStore } from '../../../utils'
import { Role, RolesReference } from '../roles'
import { AllowDefinition } from '../permissions'
import { EntityPermissionsExtension } from '../extendEntityPermissions'

export type EntityPermissionsDefinition =
	& AllowDefinition<any>
	& {
		role: Role<string>
	}
export const allowDefinitionsStore = createMetadataStore<EntityPermissionsDefinition[]>([])

export const entityPermissionsExtensionStore = createMetadataStore<{
	roles: RolesReference
	extension: EntityPermissionsExtension
}[]>([])
