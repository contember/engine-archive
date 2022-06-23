import { graphql, printSchema } from 'graphql'
import { Acl, Model } from '@contember/schema'

import {
	AllowAllPermissionFactory,
	SchemaBuilder,
	SchemaDefinition,
	SchemaDefinition as def,
} from '@contember/schema-definition'
import { Authorizator, GraphQlSchemaBuilderFactory } from '../../../../src/index.js'
import * as model from './model.js'
import { assert, describe, expect, it } from 'vitest'

interface Test {
	schema: (builder: SchemaBuilder) => SchemaBuilder | Model.Schema
	permissions: (schema: Model.Schema) => Acl.Permissions
}

const testSchema = async (test: Test) => {
	const schemaResult = test.schema(new SchemaBuilder())

	const schemaFactory = new GraphQlSchemaBuilderFactory()
	const schema = schemaResult instanceof SchemaBuilder ? schemaResult.buildSchema() : schemaResult
	const schemaWithAcl = { ...schema, acl: { roles: {}, variables: {} } }
	const permissions = test.permissions(schemaWithAcl)
	const authorizator = new Authorizator(permissions, false)
	const graphQlSchemaBuilder = schemaFactory.create(schemaWithAcl, authorizator)
	const graphQlSchema = graphQlSchemaBuilder.build()

	const result = await graphql({
		schema: graphQlSchema,
		source: `
			{
				_info {
					description
				}
			}
		`,
	})
	const errors = (result.errors || []).map(it => it.message)
	assert.deepEqual(errors, [])

	return printSchema(graphQlSchema) + '\n'
}
describe('GraphQL schema builder', () => {

	it('basic schema', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder
					.entity('Author', e =>
						e
							.column('name', c => c.type(Model.ColumnType.String))
							.oneHasMany('posts', r => r.target('Post').ownedBy('author')),
					)
					.entity('Category', e => e.column('name', c => c.type(Model.ColumnType.String)))
					.entity('Post', e =>
						e
							.column('publishedAt', c => c.type(Model.ColumnType.DateTime))
							.oneHasMany('locales', r =>
								r.target('PostLocale', e => e.column('title', c => c.type(Model.ColumnType.String))),
							)
							.manyHasMany('categories', r => r.target('Category').inversedBy('posts')),
					),
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('restricted access to fields by permissions', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder.entity('Test', e =>
					e
						.column('a', c => c.type(Model.ColumnType.String))
						.column('b', c => c.type(Model.ColumnType.String))
						.column('c', c => c.type(Model.ColumnType.String)),
				),
			permissions: () => ({
				Test: {
					predicates: {},
					operations: {
						create: {
							id: true,
							a: true,
						},
						update: {
							id: true,
							b: true,
						},
						read: {
							id: true,
							c: true,
						},
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})


	it('conditionally restricted read of some fields', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder.entity('Test', e =>
					e
						.column('a', c => c.type(Model.ColumnType.String).notNull()),
				),
			permissions: () => ({
				Test: {
					predicates: {
						testPredicate: {
							a: { eq: 'Foo' },
						},
					},
					operations: {
						read: {
							id: true,
							a: 'testPredicate',
						},
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})


	it('conditionally restricted read of whole row', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder.entity('Test', e =>
					e
						.column('a', c => c.type(Model.ColumnType.String).notNull()),
				),
			permissions: () => ({
				Test: {
					predicates: {
						testPredicate: {
							a: { eq: 'Foo' },
						},
					},
					operations: {
						read: {
							id: 'testPredicate',
							a: 'testPredicate',
						},
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})

	const oneHasManySchema = (builder: SchemaBuilder) =>
		builder.entity('Root', e =>
			e
				.column('foo', c => c.type(Model.ColumnType.String))
				.oneHasMany('r', r =>
					r.target('OneHasManyEntity', e => e.column('a', c => c.type(Model.ColumnType.String))).ownedBy('r2'),
				),
		)

	it('ACL with relations - everything allowed', async () => {
		const schema = await testSchema({
			schema: oneHasManySchema,
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('ACL with relations - restricted delete', async () => {
		const schema = await testSchema({
			schema: oneHasManySchema,
			permissions: () => ({
				Root: {
					predicates: {},
					operations: {
						create: { id: true },
						update: { id: true },
						read: { id: true },
						delete: true,
					},
				},
				OneHasManyEntity: {
					predicates: {},
					operations: {
						create: { id: true, a: true, r2: true },
						update: { id: true, a: true, r2: true },
						read: { id: true, a: true },
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})

	it('ACL with relations - restricted update', async () => {
		const schema = await testSchema({
			schema: oneHasManySchema,
			permissions: () => ({
				Root: {
					predicates: {},
					operations: {
						create: { id: true, r: true },
						update: { id: true, r: true },
						read: { id: true, r: true },
						delete: true,
					},
				},
				OneHasManyEntity: {
					predicates: {},
					operations: {
						create: { id: true, a: true, r2: true },
						read: { id: true, a: true },
						delete: true,
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})

	it('ACL with relations - restricted create', async () => {
		const schema = await testSchema({
			schema: oneHasManySchema,
			permissions: () => ({
				Root: {
					predicates: {},
					operations: {
						update: { id: true, r: true },
						read: { id: true, r: true },
						delete: true,
					},
				},
				OneHasManyEntity: {
					predicates: {},
					operations: {
						update: { id: true, a: true, r2: true },
						read: { id: true, a: true },
						delete: true,
					},
				},
			}),
		})
		expect(schema).matchSnapshot()
	})

	it('has many relation reduction', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder.entity('Post', e =>
					e
						.column('publishedAt', c => c.type(Model.ColumnType.DateTime))
						.oneHasMany('locales', r =>
							r.ownedBy('post').target('PostLocale', e =>
								e
									.unique(['locale', 'post'])
									.column('locale', c => c.type(Model.ColumnType.String))
									.column('title', c => c.type(Model.ColumnType.String)),
							),
						),
				),
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('bug with multiple relations 66', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder
					.enum('one', ['one'])
					.entity('Video', entity => entity.column('vimeoId'))
					.entity('FrontPage', entity =>
						entity
							.column('unique', column => column.type(Model.ColumnType.Enum, { enumName: 'one' }).unique().notNull())
							.oneHasOne('introVideo', relation => relation.target('Video').notNull().inversedBy('frontPageForIntro'))
							.oneHasMany('inHouseVideos', relation => relation.target('Video').ownedBy('frontPage')),
					),
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('basic schema with new builder', async () => {
		const schema1 = SchemaDefinition.createModel(model)
		const relation = schema1.entities['Author'].fields['posts']
		assert.deepEqual((relation as Model.OneHasManyRelation).orderBy, [
			{ path: ['publishedAt'], direction: Model.OrderDirection.desc },
		])
		const schema = await testSchema({
			schema: () => schema1,
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('allow only create', async () => {
		const schema = await testSchema({
			schema: () => SchemaDefinition.createModel(model),
			permissions: schema => new AllowAllPermissionFactory([Acl.Operation.create]).create(schema),
		})
		expect(schema).matchSnapshot()
	})

	it('custom primary allowed', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder
					.entity('Author', e =>
						e
							.column('name', c => c.type(Model.ColumnType.String))
							.oneHasMany('posts', r => r.target('Post').ownedBy('author')),
					)
					.entity('Category', e => e.column('name', c => c.type(Model.ColumnType.String)))
					.entity('Post', e =>
						e
							.column('publishedAt', c => c.type(Model.ColumnType.DateTime))
							.oneHasMany('locales', r =>
								r.target('PostLocale', e => e.column('title', c => c.type(Model.ColumnType.String))),
							)
							.manyHasMany('categories', r => r.target('Category').inversedBy('posts')),
					),
			permissions: schema => new AllowAllPermissionFactory().create(schema, true),
		})
		expect(schema).matchSnapshot()
	})

	it('aliased type', async () => {
		const schema = await testSchema({
			schema: builder =>
				builder.entity('Author', e => e.column('name', c => c.type(Model.ColumnType.String).typeAlias('AuthorName'))),
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})
		expect(schema).matchSnapshot()
	})


	it('view entity', async () => {
		const schema = await testSchema({
			schema: () => SchemaDefinition.createModel(ViewEntity),
			permissions: schema => new AllowAllPermissionFactory().create(schema),
		})

		expect(schema).matchSnapshot()
	})
})

namespace ViewEntity {
	@def.View("SELECT null as id, 'John' AS name")
	export class Author {
		name = def.stringColumn()
	}
}
