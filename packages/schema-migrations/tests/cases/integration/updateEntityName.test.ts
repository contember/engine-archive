import { testMigrations } from '../../src/tests'
import { SchemaBuilder, c, createSchema } from '@contember/schema-definition'
import { Model } from '@contember/schema'
import { SQL } from '../../src/tags'

testMigrations('rename entity without renaming a table', {
	original: {
		model: new SchemaBuilder()
			.entity('Author', e => e.tableName('user').column('name', c => c.type(Model.ColumnType.String)))
			.entity('Post', e => e.column('title').manyHasOne('author', r => r.target('Author')))
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('User', e => e.column('name', c => c.type(Model.ColumnType.String)))
			.entity('Post', e => e.column('title').manyHasOne('author', r => r.target('User')))
			.buildSchema(),
	},
	diff: [
		{
			modification: 'updateEntityName',
			entityName: 'Author',
			newEntityName: 'User',
		},
	],
	sql: SQL``,
	noDiff: true,
})

testMigrations('rename entity and table', {
	original: {
		model: new SchemaBuilder()
			.entity('Author', e => e.column('name', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('User', e => e.column('name', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
	},
	diff: [
		{
			modification: 'updateEntityName',
			entityName: 'Author',
			newEntityName: 'User',
			tableName: 'user',
		},
	],
	sql: SQL`ALTER TABLE "author"
		RENAME TO "user";`,
	noDiff: true,
})


testMigrations('rename entity with one-has-one (constraint)', {
	original: {
		model: new SchemaBuilder()
			.entity('Author', e => e.oneHasOne('content', r => r.target('Content')))
			.entity('Content', e => e.column('foo'))
			.buildSchema(),
	},
	updated: {
		model: new SchemaBuilder()
			.entity('User', e => e.tableName('author').oneHasOne('content', r => r.target('Content')))
			.entity('Content', e => e.column('foo'))
			.buildSchema(),
	},
	diff: [
		{
			modification: 'updateEntityName',
			entityName: 'Author',
			newEntityName: 'User',
		},
	],
	sql: SQL``,
	noDiff: true,
})


namespace RenameEntityWithOneHasManyOriginal {
	export class Article {
		name = c.stringColumn()
		labels = c.manyHasMany(Label)
	}

	export class Label {
		name = c.stringColumn()
	}
}

namespace RenameEntityWithOneHasManyUpdated {
	export class Article {
		name = c.stringColumn()
		labels = c.manyHasMany(Tag).joiningTable({
			inverseJoiningColumn: {
				columnName: 'label_id',
				onDelete: Model.OnDelete.cascade,
			},
		})
	}

	export class Tag {
		name = c.stringColumn()
	}
}

testMigrations('rename entity + table name with many-has-many (joining table)', {
	original: {
		model: createSchema(RenameEntityWithOneHasManyOriginal).model,
	},
	updated: {
		model: createSchema(RenameEntityWithOneHasManyUpdated).model,
	},
	diff: [
		{
			modification: 'updateEntityName',
			entityName: 'Label',
			newEntityName: 'Tag',
			tableName: 'tag',
		},
	],
	sql: SQL`ALTER TABLE "label" RENAME TO "tag";`,
	noDiff: true,
})

testMigrations('rename table with acl', {
	original: {
		model: new SchemaBuilder()
			.entity('Site', entity => entity.column('name', c => c.type(Model.ColumnType.String)))
			.buildSchema(),
		acl: {
			roles: {
				admin: {
					variables: {},
					stages: '*',
					entities: {
						Site: {
							predicates: {},
							operations: {
								read: {
									id: true,
								},
							},
						},
					},
				},
			},
		},
	},
	updated: {
		model: new SchemaBuilder()
			.entity('Website', entity => entity.column('name', c => c.type(Model.ColumnType.String)).tableName('site'))
			.buildSchema(),
		acl: {
			roles: {
				admin: {
					variables: {},
					stages: '*',
					entities: {
						Website: {
							predicates: {},
							operations: {
								read: {
									id: true,
								},
							},
						},
					},
				},
			},
		},
	},
	diff: [
		{
			modification: 'updateEntityName',
			entityName: 'Site',
			newEntityName: 'Website',
		},
	],
	sql: SQL``,
	noDiff: true,
})
