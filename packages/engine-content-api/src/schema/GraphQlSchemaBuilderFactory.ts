import { Model } from '@contember/schema'
import { EntityTypeProvider } from './EntityTypeProvider'
import { ColumnTypeResolver } from './ColumnTypeResolver'
import { EnumsProvider } from './EnumsProvider'
import { QueryProvider } from './QueryProvider'
import { MutationProvider } from './MutationProvider'
import { WhereTypeProvider } from './WhereTypeProvider'
import { ConditionTypeProvider } from './ConditionTypeProvider'
import { GraphQlSchemaBuilder } from './GraphQlSchemaBuilder'
import { CreateEntityInputFieldVisitor, EntityInputType } from './mutations'
import { CreateEntityRelationInputProvider } from './mutations'
import { CreateEntityRelationInputFieldVisitor } from './mutations'
import { Accessor } from '../utils'
import { UpdateEntityRelationInputFieldVisitor } from './mutations'
import { UpdateEntityRelationInputProvider } from './mutations'
import { UpdateEntityInputFieldVisitor } from './mutations'
import { EntityInputProvider } from './mutations'
import { UpdateEntityRelationAllowedOperationsVisitor } from './mutations'
import { CreateEntityRelationAllowedOperationsVisitor } from './mutations'
import { OrderByTypeProvider } from './OrderByTypeProvider'
import { HasManyToHasOneReducer } from '../extensions'
import { HasManyToHasOneRelationReducerFieldVisitor } from '../extensions'
import { ValidationQueriesProvider } from './ValidationQueriesProvider'
import { CustomTypesProvider } from './CustomTypesProvider'
import { ResultSchemaTypeProvider } from './ResultSchemaTypeProvider'
import { PaginatedFieldConfigFactory } from './PaginatedFieldConfigFactory'
import { PaginatedHasManyFieldProvider } from '../extensions/paginatedHasMany/PaginatedHasManyFieldProvider'
import { PaginatedHasManyFieldProviderVisitor } from '../extensions/paginatedHasMany/PaginatedHasManyFieldProviderVisitor'
import { Builder } from '@contember/dic'
import { ConnectOrCreateRelationInputProvider } from './mutations/ConnectOrCreateRelationInputProvider'
import { Permissions } from '../acl'

export class GraphQlSchemaBuilderFactory {
	constructor() {}

	public create(schema: Model.Schema, permissions: Permissions): GraphQlSchemaBuilder {
		return this.createContainerBuilder(schema, permissions).build().graphQlSchemaBuilder
	}

	public createContainerBuilder(schema: Model.Schema, permissions: Permissions) {
		return new Builder({})
			.addService('schema', () =>
				schema)
			.addService('permissions', () =>
				permissions)
			.addService('customTypesProvider', ({}) =>
				new CustomTypesProvider())
			.addService('enumsProvider', ({ schema }) =>
				new EnumsProvider(schema))
			.addService('columnTypeResolver', ({ schema, enumsProvider, customTypesProvider }) =>
				new ColumnTypeResolver(schema, enumsProvider, customTypesProvider))
			.addService('conditionTypeProvider', ({ columnTypeResolver }) =>
				new ConditionTypeProvider(columnTypeResolver))
			.addService('whereTypeProvider', ({ schema, permissions, columnTypeResolver, conditionTypeProvider }) =>
				new WhereTypeProvider(schema, permissions, columnTypeResolver, conditionTypeProvider))
			.addService('orderByTypeProvider', ({ schema, permissions }) =>
				new OrderByTypeProvider(schema, permissions))
			.addService('entityTypeProvider', ({ schema, permissions, columnTypeResolver, whereTypeProvider, orderByTypeProvider }) =>
				new EntityTypeProvider(schema, permissions, columnTypeResolver, whereTypeProvider, orderByTypeProvider))
			.addService('paginatedFieldConfigFactory', ({ whereTypeProvider, orderByTypeProvider, entityTypeProvider }) =>
				new PaginatedFieldConfigFactory(whereTypeProvider, orderByTypeProvider, entityTypeProvider))
			.addService('hasManyToOneReducerVisitor', ({ schema, permissions, entityTypeProvider, whereTypeProvider }) =>
				new HasManyToHasOneRelationReducerFieldVisitor(schema, permissions, entityTypeProvider, whereTypeProvider))
			.addService('hasManyToOneReducer', ({ schema, hasManyToOneReducerVisitor }) =>
				new HasManyToHasOneReducer(schema, hasManyToOneReducerVisitor))
			.addService('paginatedHasManyFieldProviderVisitor', ({ paginatedFieldConfigFactory }) =>
				new PaginatedHasManyFieldProviderVisitor(paginatedFieldConfigFactory))
			.addService('paginatedHasManyFieldProvider', ({ schema, paginatedHasManyFieldProviderVisitor }) =>
				new PaginatedHasManyFieldProvider(schema, paginatedHasManyFieldProviderVisitor))
			.addService('queryProvider', ({ permissions, whereTypeProvider, orderByTypeProvider, entityTypeProvider, paginatedFieldConfigFactory }) =>
				new QueryProvider(permissions, whereTypeProvider, orderByTypeProvider, entityTypeProvider, paginatedFieldConfigFactory))
			.addService('createEntityInputProviderAccessor', ({}) =>
				new Accessor<EntityInputProvider<EntityInputType.create>>())
			.addService('createEntityRelationAllowedOperationsVisitor', ({ permissions }) =>
				new CreateEntityRelationAllowedOperationsVisitor(permissions))
			.addService('connectOrCreateRelationInputProvider', ({ schema, whereTypeProvider, createEntityInputProviderAccessor }) =>
				 new ConnectOrCreateRelationInputProvider(schema, whereTypeProvider, createEntityInputProviderAccessor))
			.addService('createEntityRelationInputFieldVisitor', ({ schema,	whereTypeProvider, createEntityInputProviderAccessor, createEntityRelationAllowedOperationsVisitor, connectOrCreateRelationInputProvider }) =>
				new CreateEntityRelationInputFieldVisitor(schema, whereTypeProvider, createEntityInputProviderAccessor, createEntityRelationAllowedOperationsVisitor, connectOrCreateRelationInputProvider))
			.addService('createEntityRelationInputProvider', ({ schema, createEntityRelationInputFieldVisitor }) =>
				new CreateEntityRelationInputProvider(schema, createEntityRelationInputFieldVisitor))
			.addService('createEntityInputFieldVisitor', ({ schema, permissions, columnTypeResolver, createEntityRelationInputProvider }) =>
				new CreateEntityInputFieldVisitor(schema, permissions, columnTypeResolver, createEntityRelationInputProvider))
			.addService('createEntityInputProvider', ({ schema, permissions, createEntityInputFieldVisitor }) =>
				new EntityInputProvider(EntityInputType.create, schema, permissions, createEntityInputFieldVisitor))
			.addService('updateEntityInputProviderAccessor', ({}) =>
				new Accessor<EntityInputProvider<EntityInputType.update>>())
			.addService('updateEntityRelationAllowedOperationsVisitor', ({ permissions }) =>
				new UpdateEntityRelationAllowedOperationsVisitor(permissions))
			.addService('updateEntityRelationInputFieldVisitor', ({ schema, permissions, whereTypeProvider, updateEntityInputProviderAccessor, createEntityInputProvider, updateEntityRelationAllowedOperationsVisitor, connectOrCreateRelationInputProvider }) =>
				new UpdateEntityRelationInputFieldVisitor(schema, permissions, whereTypeProvider, updateEntityInputProviderAccessor, createEntityInputProvider, updateEntityRelationAllowedOperationsVisitor, connectOrCreateRelationInputProvider))
			.addService('updateEntityRelationInputProvider', ({ schema, updateEntityRelationInputFieldVisitor }) =>
				new UpdateEntityRelationInputProvider(schema, updateEntityRelationInputFieldVisitor))
			.addService('updateEntityInputFieldVisitor', ({ permissions, columnTypeResolver, updateEntityRelationInputProvider }) =>
				new UpdateEntityInputFieldVisitor(permissions, columnTypeResolver, updateEntityRelationInputProvider))
			.addService('updateEntityInputProvider', ({ schema, permissions, updateEntityInputFieldVisitor }) =>
				new EntityInputProvider(EntityInputType.update, schema, permissions, updateEntityInputFieldVisitor))
			.addService('resultSchemaTypeProvider', ({}) =>
				new ResultSchemaTypeProvider())
			.addService('mutationProvider', ({ permissions, whereTypeProvider, entityTypeProvider, createEntityInputProvider, updateEntityInputProvider, resultSchemaTypeProvider }) =>
				new MutationProvider(permissions, whereTypeProvider, entityTypeProvider, createEntityInputProvider, updateEntityInputProvider, resultSchemaTypeProvider))
			.addService('validationQueriesProvider', ({ whereTypeProvider, createEntityInputProvider, updateEntityInputProvider, resultSchemaTypeProvider }) =>
				new ValidationQueriesProvider(whereTypeProvider, createEntityInputProvider, updateEntityInputProvider, resultSchemaTypeProvider))
			.addService('graphQlSchemaBuilder', ({ schema, queryProvider, validationQueriesProvider, mutationProvider, resultSchemaTypeProvider }) =>
				new GraphQlSchemaBuilder(schema, queryProvider, validationQueriesProvider, mutationProvider, resultSchemaTypeProvider))
			.setupService('createEntityInputProvider', (it, { createEntityInputProviderAccessor }) => {
				createEntityInputProviderAccessor.set(it)
			})
			.setupService('updateEntityInputProvider', (it, { updateEntityInputProviderAccessor }) => {
				updateEntityInputProviderAccessor.set(it)
			})
			.setupService('entityTypeProvider', (it, { hasManyToOneReducer }) => {
				it.registerEntityFieldProvider(HasManyToHasOneReducer.extensionName, hasManyToOneReducer)
			})
			.setupService('entityTypeProvider', (it, { paginatedHasManyFieldProvider }) => {
				it.registerEntityFieldProvider(PaginatedHasManyFieldProvider.extensionName, paginatedHasManyFieldProvider)
			})
	}
}
