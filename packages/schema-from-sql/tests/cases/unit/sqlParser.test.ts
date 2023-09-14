import { expect, test } from 'vitest'
import { SqlParser } from '../../../src/SqlParser'
import { CreateColumnDef, parse, TableConstraintForeignKey, TableConstraintUnique } from 'pgsql-ast-parser'
import { emptySchema, resolveDefaultColumnType } from '@contember/schema-utils'
import { createColumnModification, createEntityModification, Migration } from '@contember/schema-migrations'
import { Model } from '@contember/schema'

const parser = new SqlParser()
test('parse basic types', () => {
	expect(parser.parse(`CREATE TABLE Member
                         (
                             name       TEXT,
                             age        INT,
                             invalid_ignored,
                             credits    DOUBLE PRECISION,
                             access     BIT VARYING(5),
                             created_at TIMESTAMP WITH TIME ZONE
                         )`)).toMatchInlineSnapshot(`
  [
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "name",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "int",
            "type": "data type def",
          },
          "name": "age",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "double",
            "type": "data type def",
          },
          "name": "credits",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": [
              5,
            ],
            "name": "bit",
            "type": "data type def",
          },
          "name": "access",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "timestamp with time zone",
            "type": "data type def",
          },
          "name": "created_at",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Member",
      "type": "create table",
    },
  ]
`)
})


test('parse multiple tables', () => {
	expect(parser.parse(`
        CREATE TABLE foo
        (

            value TEXT
        );
        CREATE TABLE bar
        (

            value TEXT
        )
	`)).toMatchInlineSnapshot(`
		[
		  {
		    "columns": [
		      {
		        "constraints": [],
		        "dataType": {
		          "config": undefined,
		          "name": "TEXT",
		          "type": "data type def",
		        },
		        "name": "value",
		        "type": "column def",
		      },
		    ],
		    "constraints": [],
		    "tableName": "foo",
		    "type": "create table",
		  },
		  {
		    "columns": [
		      {
		        "constraints": [],
		        "dataType": {
		          "config": undefined,
		          "name": "TEXT",
		          "type": "data type def",
		        },
		        "name": "value",
		        "type": "column def",
		      },
		    ],
		    "constraints": [],
		    "tableName": "bar",
		    "type": "create table",
		  },
		]
	`)
})

test('parse not null constraint', () => {
	expect(parser.parse(`CREATE TABLE foo
                         (

                             value TEXT NOT NULL
                         )`)).toMatchInlineSnapshot(`
  [
    {
      "columns": [
        {
          "constraints": [
            {
              "type": "not null",
            },
          ],
          "dataType": {
            "config": undefined,
            "name": "text",
            "type": "data type def",
          },
          "name": "value",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "foo",
      "type": "create table",
    },
  ]
`)
})
test('parse foreign key', () => {
	expect(parser.parse(`
        CREATE TABLE foo
        (
            value1 UUID REFERENCES article (id) ON DELETE CASCADE ON UPDATE RESTRICT DEFERRABLE INITIALLY DEFERRED,
            value2 UUID REFERENCES article ON DELETE SET NULL ON UPDATE NO ACTION NOT DEFERRABLE INITIALLY IMMEDIATE,
            value3 UUID REFERENCES article (id) ON DELETE CASCADE ON UPDATE RESTRICT DEFERRABLE INITIALLY IMMEDIATE
        )
	`)).toMatchInlineSnapshot(`
  [
    {
      "columns": [
        {
          "constraints": [
            {
              "deferrable": true,
              "initiallyDeferred": true,
              "onDelete": "cascade",
              "onUpdate": "restrict",
              "refColumn": "id",
              "refTable": "article",
              "type": "references",
            },
          ],
          "dataType": {
            "config": undefined,
            "name": "uuid",
            "type": "data type def",
          },
          "name": "value1",
          "type": "column def",
        },
        {
          "constraints": [
            {
              "deferrable": false,
              "initiallyDeferred": false,
              "onDelete": "set null",
              "onUpdate": "no action",
              "refColumn": undefined,
              "refTable": "article",
              "type": "references",
            },
          ],
          "dataType": {
            "config": undefined,
            "name": "uuid",
            "type": "data type def",
          },
          "name": "value2",
          "type": "column def",
        },
        {
          "constraints": [
            {
              "deferrable": true,
              "initiallyDeferred": false,
              "onDelete": "cascade",
              "onUpdate": "restrict",
              "refColumn": "id",
              "refTable": "article",
              "type": "references",
            },
          ],
          "dataType": {
            "config": undefined,
            "name": "uuid",
            "type": "data type def",
          },
          "name": "value3",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "foo",
      "type": "create table",
    },
  ]
`)
})


test.only('complex', () => {
	const result = parse(`CREATE TABLE Person
                          (
                              id         UUID PRIMARY KEY,
                              created_at timestamp (1) WITH TIME ZONE,
                              created_at2 timestamp (1),
                              created_at3 timestamp (1) WITHOUT TIME ZONE,
                              name       TEXT,
                              email      TEXT,
                              phone      TEXT,
                              address    TEXT,
                              society_id UUID,
                              FOREIGN KEY (society_id) REFERENCES Society (id)
                          );

    CREATE TABLE Society
    (
        id            UUID PRIMARY KEY,
        name          TEXT,
        description   TEXT,
        creation_date DATE
    );

    CREATE TABLE Membership
    (
        id             UUID PRIMARY KEY,
        start_date     DATE,
        end_date       DATE,
        membership_fee NUMBER,
        person_id      UUID,
        FOREIGN KEY (person_id) REFERENCES Person (id)
    );

    CREATE TABLE Role
    (
        id          UUID PRIMARY KEY,
        name        TEXT,
        description TEXT
    );

    CREATE TABLE Person_Role
    (
        id        UUID PRIMARY KEY,
        person_id UUID,
        role_id   UUID,
        FOREIGN KEY (person_id) REFERENCES Person (id),
        FOREIGN KEY (role_id) REFERENCES Role (id)
    );

    CREATE TABLE Guest
    (
        id         UUID PRIMARY KEY,
        name       TEXT,
        email      TEXT,
        phone      TEXT,
        address    TEXT,
        society_id UUID,
        FOREIGN KEY (society_id) REFERENCES Society (id)
    );

    CREATE TABLE Person
    (
        id UUID PRIMARY KEY
    );

    CREATE TABLE Society
    (
        id UUID PRIMARY KEY
    );

    CREATE TABLE Membership
    (
        id UUID PRIMARY KEY
    );

    CREATE TABLE Role
    (
        id UUID PRIMARY KEY
    );
    ALTER TABLE Person
        ADD COLUMN society_id UUID;
    ALTER TABLE Person
        ADD FOREIGN KEY (society_id) REFERENCES Society (id);

    CREATE TABLE Person_Role
    (
        id        UUID PRIMARY KEY,
        person_id UUID,
        role_id   UUID,
        FOREIGN KEY (person_id) REFERENCES Person (id),
        FOREIGN KEY (role_id) REFERENCES Role (id)
    );

    ALTER TABLE Membership
        ADD COLUMN person_id UUID;
    ALTER TABLE Membership
        ADD FOREIGN KEY (person_id) REFERENCES Person (id);
    ALTER TABLE Person
        ADD COLUMN name    TEXT,
        ADD COLUMN email   TEXT,
        ADD COLUMN phone   TEXT,
        ADD COLUMN address TEXT;
    ALTER TABLE Society
        ADD COLUMN name          TEXT,
        ADD COLUMN description   TEXT,
        ADD COLUMN creation_date DATE;
    ALTER TABLE Membership
        ADD COLUMN start_date     DATE,
        ADD COLUMN end_date       DATE,
        ADD COLUMN membership_fee NUMBER;
    ALTER TABLE Role
        ADD COLUMN name        TEXT,
        ADD COLUMN description TEXT;
    CREATE TABLE Guest
    (
        id UUID PRIMARY KEY
    );
    ALTER TABLE Guest
        ADD COLUMN society_id UUID;
    ALTER TABLE Guest
        ADD FOREIGN KEY (society_id) REFERENCES Society (id);
    ALTER TABLE Guest
        ADD COLUMN name    TEXT,
        ADD COLUMN email   TEXT,
        ADD COLUMN phone   TEXT,
        ADD COLUMN address TEXT;`)



	let schema = emptySchema

	const modifications: Migration.Modification[] = []


	function toPascalCase(str: string) {
		return str
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join('')
	}

	function toCamelCase(str: string) {
		const words = str.split('_')
		return [
			words[0].toLowerCase(),
			...words.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()),
		].join('')
	}


	// pass one
	// - create tables modifications

	result.forEach(stm => {
		switch (stm.type) {
			case 'create table':
				// todo: if m-n, skip
				modifications.push(createEntityModification.createModification({
					entity: {
						name: toPascalCase(stm.name.name),
						tableName: stm.name.name,
						primary: 'id',
						primaryColumn: 'id',
						fields: {
							id: {
								name: 'id',
								type: Model.ColumnType.Uuid,
								columnType: 'uuid',
								nullable: false,
								columnName: 'id',
							},
						},
						unique: [],
					},
				}))
		}
	})

	// - create constraints map
	const constraints: Record<string, {
		unique: TableConstraintUnique[]
		fk: TableConstraintForeignKey[]
	}> = {}

	result.forEach(stm => {
		const forTable = (name: string) => {
			return constraints[name] ??= { fk: [], unique: [] }
		}

		switch (stm.type) {
			case 'create table': {
				const constraints = forTable(stm.name.name)
				stm.constraints?.forEach(it => {
					switch (it.type) {
						case 'unique':
							constraints.unique.push(it)
							break
						case 'foreign key':
							constraints.fk.push(it)
					}
				})
				stm.columns.forEach(it => {
					switch (it.kind) {
						case 'column':
							it.constraints?.forEach(constraint => {
								switch (constraint.type) {
									case 'unique':
										constraints.unique.push({
											type: 'unique',
											columns: [it.name],
											constraintName: constraint.constraintName,
										})
										break
									case 'reference':
										constraints.fk.push(({
											...constraint,
											type: 'foreign key',
											localColumns: [it.name],
										}))
										break
								}
							})
							break
					}
				})
				break
			}
			case 'alter table': {
				const constraints = forTable(stm.table.name)
				stm.changes.forEach(change => {
					switch (change.type) {
						case 'add constraint':
							switch (change.constraint.type) {
								case 'foreign key':
									constraints.fk.push(change.constraint)
									break
								case 'unique':
									constraints.unique.push(change.constraint)
									break
							}
					}
				})
				break
			}
		}
	})

	const detectColumnType = (pgtype: string): Exclude<Model.ColumnType, Model.ColumnType.Enum> => {
		switch (pgtype.toLowerCase()) {
			case 'int8':
			case 'int4':
			case 'int2':
			case 'bigint':
			case 'int':
			case 'smallint':
			case 'integer':
			case 'number': // pseudo-type generated by openai
				return Model.ColumnType.Int
			case 'text':
			case 'varchar':
			case 'character varying':
			case 'char':
			case 'character':
				return Model.ColumnType.String
			case 'json':
			case 'jsonb':
				return Model.ColumnType.Json
			case 'double precision':
			case 'float8':
			case 'numeric':
			case 'decimal':
			case 'real':
			case 'float4':
				return Model.ColumnType.Double
			case 'bool':
			case 'boolean':
				return Model.ColumnType.Bool
			case 'date':
				return Model.ColumnType.Date
			case 'time':
				return Model.ColumnType.String // todo
			case 'timestamp':
			case 'timestamp with time zone':
			case 'timestamp without time zone':
				return Model.ColumnType.DateTime
			case 'uuid':
				return Model.ColumnType.Uuid
		}
		return Model.ColumnType.String // or omit?
	}

	result.forEach(stm => {
		const processColumn = (table: string, column: CreateColumnDef) => {
			const tableConstraints = constraints[table]
			const columnFk = tableConstraints.fk.find(it => it.localColumns[0].name === column.name.name)
			const isUnique = !!tableConstraints.unique.find(it => it.columns.length === 1 && it.columns[0].name === column.name.name)

			// ordinary column
			if (!columnFk) {
				const type = column.dataType.kind === 'array'
					? Model.ColumnType.Json
					: detectColumnType(column.dataType.name)

				modifications.push(createColumnModification.createModification({
					entityName: toPascalCase(table),
					field: {
						name: toCamelCase(column.name.name),
						type: type,
						columnName: column.name.name,
						columnType: resolveDefaultColumnType(type),
						nullable: !!column.constraints?.find(it => it.type === 'not null'),
					},
				}))
			}
		}
		switch (stm.type) {
			case 'create table': {
				stm.columns.forEach(it => {
					if (it.kind === 'column') {
						processColumn(stm.name.name, it)
					}
				})
				break
			}
			case 'alter table': {
				stm.changes.forEach(it => {
					if (it.type === 'add column') {
						processColumn(stm.table.name, it.column)
					}
				})
				break
			}

		}
	})
})
