import { PermissionFactory, PredicateFactory, PredicatesInjector, VariableInjector } from '../../../src/acl'
import { SchemaBuilder, SchemaDefinition as def, AclDefinition as acl, createSchema, PermissionsBuilder } from '@contember/schema-definition'
import { Acl, Model } from '@contember/schema'
import { describe, it, assert } from 'vitest'
import { PermissionsFactory } from '@contember/engine-system-api/dist/src/model'
import { WhereOptimizer } from '../../../src/mapper/select/optimizer/WhereOptimizer'
import { ConditionOptimizer } from '../../../src/mapper/select/optimizer/ConditionOptimizer'
import { acceptFieldVisitor, AllowAllPermissionFactory } from '@contember/schema-utils'
import { testUuid } from '@contember/engine-api-tester'



const schema = new SchemaBuilder()
	.enum('locale', ['cs', 'en'])
	.entity('Post', entityBuilder => entityBuilder.oneHasMany('locales', c => c.target('PostLocale')))
	.entity('PostLocale', entity =>
		entity
			.column('title', column => column.type(Model.ColumnType.String))
			.column('content', column => column.type(Model.ColumnType.String))
			.column('locale', column => column.type(Model.ColumnType.Enum, { enumName: 'locale' })),
	)
	.buildSchema()

const permissions: Acl.Permissions = {
	Post: {
		predicates: {},
		operations: {
			read: {
				id: true,
				locales: true,
			},
		},
	},
	PostLocale: {
		predicates: {
			localePredicate: {
				locale: 'localeVariable',
			},
			localePredicate2: {
				locale: 'localeVariable',
			},
		},
		operations: {
			read: {
				id: 'localePredicate',
				title: 'localePredicate2',
				content: 'localePredicate',
			},
		},
	},
}


describe('Predicates injector', () => {

	const variables: Acl.VariablesMap = {
		localeVariable: { in: ['cs'] },
	}
	it('injects predicate', () => {
		const injector = new PredicatesInjector(
			schema,
			new PredicateFactory(permissions, schema, new VariableInjector(schema, variables)),
		)
		const result = injector.inject(schema.entities['PostLocale'], {})

		assert.deepStrictEqual(result, {
			locale: { in: ['cs'] },
		})
	})

	it('merges predicate with explicit where', () => {
		const injector = new PredicatesInjector(
			schema,
			new PredicateFactory(permissions, schema, new VariableInjector(schema, variables)),
		)
		const result = injector.inject(schema.entities['PostLocale'], { id: { in: [1, 2] } })

		assert.deepStrictEqual(result, {
			and: [
				{
					id: { in: [1, 2] },
				},
				{
					locale: { in: ['cs'] },
				},
			],
		})
	})

	it('injects predicate to where', () => {
		const injector = new PredicatesInjector(
			schema,
			new PredicateFactory(permissions, schema, new VariableInjector(schema, variables)),
		)

		const result = injector.inject(schema.entities['PostLocale'], { title: { eq: 'abc' } })

		assert.deepStrictEqual(result, {
			and: [
				{
					and: [
						{
							title: { eq: 'abc' },
						},
						{
							locale: { in: ['cs'] },
						},
					],
				},
				{
					locale: { in: ['cs'] },
				},
			],
		})
	})


})

namespace DeepFilterModel {
	export const readerRole = acl.createRole('reader')

	@acl.allow(readerRole, {
		when: { isPublished: { eq: true } },
		read: ['coverPhoto'],
	})
	export class Article {
		isPublished = def.boolColumn()
		title = def.stringColumn()
		coverPhoto = def.manyHasOne(ImageUse, 'articles')
	}

	@acl.allow(readerRole, {
		when: { articles: acl.canRead('coverPhoto') },
		read: true,
	})
	export class ImageUse {
		articles = def.oneHasMany(Article, 'coverPhoto')
		image = def.manyHasOne(Image, 'uses')
	}

	@acl.allow(readerRole, {
		when: { uses: acl.canRead('image') },
		read: true,
	})
	export class Image {
		uses = def.oneHasMany(ImageUse, 'image')
		url = def.stringColumn()
		tags = def.manyHasMany(Tag)
	}

	@acl.allow(readerRole, {
		read: true,
	})
	export class Tag {
		label = def.stringColumn()
	}
}


describe('predicates injector elimination', () => {
	const schema = createSchema(DeepFilterModel)
	const permissions = new PermissionFactory(schema.model).create(schema.acl, ['reader'])

	const injector = new PredicatesInjector(
		schema.model,
		new PredicateFactory(permissions, schema.model, new VariableInjector(schema.model, {})),
	)
	it('eliminates predicates in where', () => {
		const injected = injector.inject(schema.model.entities.Article, {
			coverPhoto: { image: { tags: { label: { eq: 'foo' } } } },
		})
		const optimizer = new WhereOptimizer(schema.model, new ConditionOptimizer())
		const result = optimizer.optimize(injected, schema.model.entities.Article)

		assert.deepStrictEqual(result, { and: [{ coverPhoto: { image: { tags: { label: { eq: 'foo' } } } } }, { isPublished: { eq: true } }] })
	})

	it('eliminate back referencing predicate', () => {
		const relation = acceptFieldVisitor(schema.model, schema.model.entities.Article, 'coverPhoto', {
			visitColumn: () => {
				throw new Error()
			},
			visitRelation: ctx => ctx,
		})
		const injected = injector.inject(schema.model.entities.ImageUse, {
			articles: { id: { in: [testUuid(1)] } },
		}, relation)

		assert.deepStrictEqual(injected, {
			and: [
				{
					articles: {
						and: [
							{ id: { in: [testUuid(1)] } },
							{ id: { always: true } },
						],
					},
				},
				{
					articles: { id: { always: true } },
				},
			],
		})
	})
})

describe('predicate injector input handling', () => {
	const schema = createSchema(DeepFilterModel)
	const permissions = new AllowAllPermissionFactory().create(schema.model)
	const injector = new PredicatesInjector(
		schema.model,
		new PredicateFactory(permissions, schema.model, new VariableInjector(schema.model, {})),
	)
	it('handles null', () => {
		injector.inject(schema.model.entities.ImageUse, {
			image: null,
			articles: {
				and: [
					null,
					{
						title: null,
					},
				],
				not: null,
				or: null,
			},
		})
	})
})
