import { expect, test } from 'vitest'
import { SqlParser } from '../../../src/SqlParser'

const parser = new SqlParser()
test('parse basic types', () => {
	expect(parser.parse(`CREATE TABLE Member (
    name TEXT,
    age int,
    invalid_ignored,
	credits double PRECISION,
    access bit varying (5),
    created_at timestamp WITH TIME ZONE 
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
	expect(parser.parse(`create table foo (
    
	value text not null
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
	 value1 uuid references article(id) on DELETE CASCADE on update restrict DEFERRABLE INITIALLY DEFERRED,
	 value2 uuid references article on DELETE set null on update NO ACTION not DEFERRABLE INITIALLY IMMEDIATE ,
	 value3 uuid references article(id) on DELETE CASCADE on update restrict DEFERRABLE INITIALLY IMMEDIATE 
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


test('complex', () => {
	expect(parser.parse(`CREATE TABLE Person (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  society_id UUID,
  FOREIGN KEY (society_id) REFERENCES Society(id)
);

CREATE TABLE Society (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  creation_date DATE
);

CREATE TABLE Membership (
  id UUID PRIMARY KEY,
  start_date DATE,
  end_date DATE,
  membership_fee NUMBER,
  person_id UUID,
  FOREIGN KEY (person_id) REFERENCES Person(id)
);

CREATE TABLE Role (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT
);

CREATE TABLE Person_Role (
  id UUID PRIMARY KEY,
  person_id UUID,
  role_id UUID,
  FOREIGN KEY (person_id) REFERENCES Person(id),
  FOREIGN KEY (role_id) REFERENCES Role(id)
);

CREATE TABLE Guest (
  id UUID PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  society_id UUID,
  FOREIGN KEY (society_id) REFERENCES Society(id)
);

CREATE TABLE Person (
  id UUID PRIMARY KEY
);

CREATE TABLE Society (
  id UUID PRIMARY KEY
);

CREATE TABLE Membership (
  id UUID PRIMARY KEY
);

CREATE TABLE Role (
  id UUID PRIMARY KEY
);
ALTER TABLE Person ADD COLUMN society_id UUID;
ALTER TABLE Person ADD FOREIGN KEY (society_id) REFERENCES Society(id);

CREATE TABLE Person_Role (
  id UUID PRIMARY KEY,
  person_id UUID,
  role_id UUID,
  FOREIGN KEY (person_id) REFERENCES Person(id),
  FOREIGN KEY (role_id) REFERENCES Role(id)
);

ALTER TABLE Membership ADD COLUMN person_id UUID;
ALTER TABLE Membership ADD FOREIGN KEY (person_id) REFERENCES Person(id);
ALTER TABLE Person
ADD COLUMN name TEXT,
ADD COLUMN email TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN address TEXT;
ALTER TABLE Society
ADD COLUMN name TEXT,
ADD COLUMN description TEXT,
ADD COLUMN creation_date DATE;
ALTER TABLE Membership
ADD COLUMN start_date DATE,
ADD COLUMN end_date DATE,
ADD COLUMN membership_fee NUMBER;
ALTER TABLE Role
ADD COLUMN name TEXT,
ADD COLUMN description TEXT;
CREATE TABLE Guest (
  id UUID PRIMARY KEY
);
ALTER TABLE Guest ADD COLUMN society_id UUID;
ALTER TABLE Guest ADD FOREIGN KEY (society_id) REFERENCES Society(id);
ALTER TABLE Guest
ADD COLUMN name TEXT,
ADD COLUMN email TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN address TEXT;`)).toMatchInlineSnapshot(`
  [
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
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
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "email",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "phone",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "address",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "society_id",
          "type": "column def",
        },
      ],
      "constraints": [
        {
          "columns": [
            "society_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Society",
          "type": "foreign key",
        },
      ],
      "tableName": "Person",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
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
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "description",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "DATE",
            "type": "data type def",
          },
          "name": "creation_date",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Society",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "DATE",
            "type": "data type def",
          },
          "name": "start_date",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "DATE",
            "type": "data type def",
          },
          "name": "end_date",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "NUMBER",
            "type": "data type def",
          },
          "name": "membership_fee",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "person_id",
          "type": "column def",
        },
      ],
      "constraints": [
        {
          "columns": [
            "person_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Person",
          "type": "foreign key",
        },
      ],
      "tableName": "Membership",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
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
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "description",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Role",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "person_id",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "role_id",
          "type": "column def",
        },
      ],
      "constraints": [
        {
          "columns": [
            "person_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Person",
          "type": "foreign key",
        },
        {
          "columns": [
            "role_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Role",
          "type": "foreign key",
        },
      ],
      "tableName": "Person_Role",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
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
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "email",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "phone",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "TEXT",
            "type": "data type def",
          },
          "name": "address",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "society_id",
          "type": "column def",
        },
      ],
      "constraints": [
        {
          "columns": [
            "society_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Society",
          "type": "foreign key",
        },
      ],
      "tableName": "Guest",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Person",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Society",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Membership",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Role",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "person_id",
          "type": "column def",
        },
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "role_id",
          "type": "column def",
        },
      ],
      "constraints": [
        {
          "columns": [
            "person_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Person",
          "type": "foreign key",
        },
        {
          "columns": [
            "role_id",
          ],
          "constraintName": undefined,
          "deferrable": false,
          "initiallyDeferred": false,
          "onDelete": undefined,
          "onUpdate": undefined,
          "refColumn": "id",
          "refTable": "Role",
          "type": "foreign key",
        },
      ],
      "tableName": "Person_Role",
      "type": "create table",
    },
    {
      "columns": [
        {
          "constraints": [],
          "dataType": {
            "config": undefined,
            "name": "UUID",
            "type": "data type def",
          },
          "name": "id",
          "type": "column def",
        },
      ],
      "constraints": [],
      "tableName": "Guest",
      "type": "create table",
    },
  ]
`)
})
