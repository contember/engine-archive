import { DefaultNamingConventions } from '@contember/schema-utils'
import { SchemaBuilder, throwingSchemaBuilderErrorHandler } from '../schema-builder/SchemaBuilder'
import { SchemaUpdater } from '../schema-builder/schemaUpdateUtils'
import { SchemaPartsFactory } from '../schema-builder/SchemaPartsFactory'
import {
	VERSION_ACL_PATCH,
	VERSION_REMOVE_REFERENCING_RELATIONS,
	VERSION_REMOVE_RELATION_INVERSE_SIDE, VERSION_UPDATE_CONSTRAINT_FIELDS,
	VERSION_UPDATE_INDEX_FIELDS,
} from './ModificationVersions'

export const builder = (options: { formatVersion: number }, cb: (builder: SchemaBuilder) => SchemaBuilder): SchemaUpdater => {
	return ({ schema }) => {
		const builder = new SchemaBuilder(
			schema,
			throwingSchemaBuilderErrorHandler,
			new SchemaPartsFactory(new DefaultNamingConventions()),
			{
				patchAcl: options.formatVersion >= VERSION_ACL_PATCH,
				removeReferencingRelation: options.formatVersion >= VERSION_REMOVE_REFERENCING_RELATIONS,
				removeRelationInverseSide: options.formatVersion >= VERSION_REMOVE_RELATION_INVERSE_SIDE,
				updateIndexesFields: options.formatVersion >= VERSION_UPDATE_INDEX_FIELDS,
				updateConstraintFields: options.formatVersion >= VERSION_UPDATE_CONSTRAINT_FIELDS,
			},
		)
		return cb(builder).schema
	}
}
