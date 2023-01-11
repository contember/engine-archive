import { Model, Writable } from '@contember/schema'
import { EnumTypeDefinitionNode, ObjectTypeDefinitionNode, parse } from 'graphql'
import { DefaultNamingConventions, NamingConventions, resolveDefaultColumnType } from '@contember/schema-utils'
import { FieldDefinitionNode } from 'graphql/language/ast'

const scalarTypeMapping: Record<string, Exclude<Model.ColumnType, Model.ColumnType.Enum>> = {
	String: Model.ColumnType.String,
	Int: Model.ColumnType.Int,
	Float: Model.ColumnType.Double,
	Boolean: Model.ColumnType.Bool,
	Uuid: Model.ColumnType.Uuid,
	Date: Model.ColumnType.Date,
	DateTime: Model.ColumnType.DateTime,
	Json: Model.ColumnType.Json,
}



export class GraphqlToSchemaConverter {
	constructor(
		private conventions: NamingConventions = new DefaultNamingConventions(),
	) {
	}

	public convert(graphqlSchema: string): Model.Schema {
		const typeDefs: ObjectTypeDefinitionNode[] = []
		const enumsDefs: EnumTypeDefinitionNode[] = []
		for (const def of parse(graphqlSchema).definitions) {
			switch (def.kind) {
				case 'ObjectTypeDefinition':
					typeDefs.push(def)
					break
				case 'EnumTypeDefinition':
					enumsDefs.push(def)
					break
				case 'ScalarTypeDefinition':
					if (!(def.name.value in scalarTypeMapping)) {
						throw new Error(`Unsupported scalar ${def.name.value}`)
					}
					break
				default:
					throw new Error(`Unsupported ${def.kind}`)
			}
		}

		const builder = new GraphqlConverterBuilder(
			this.conventions,
			Object.fromEntries(typeDefs.map(it => [it.name.value, it])),
			Object.fromEntries(enumsDefs.map(it => [it.name.value, it])),
		)
		return builder.build()
	}
}

type UnwrappedType = { nullable: boolean; array: boolean; type: string }

class GraphqlConverterBuilder {
	private entities: Record<string, Model.Entity> = {}
	constructor(
		private conventions: NamingConventions,
		private entityDefinitions: Record<string, ObjectTypeDefinitionNode>,
		private enumDefinitions: Record<string, EnumTypeDefinitionNode>,
	) {
	}


	public build() {
		for (const def of Object.values(this.entityDefinitions)) {
			this.processDefinitionFields(def)
		}

		return {
			enums: Object.fromEntries(Object.values(this.enumDefinitions).map(it => this.createEnum(it))),
			entities: this.entities,
		}
	}

	private createEnum(def: EnumTypeDefinitionNode): [name: string, values: string[]] {
		return [
			def.name.value,
			def.values?.map(it => it.name.value) ?? [],
		]
	}

	private processDefinitionFields(def: ObjectTypeDefinitionNode): void {
		const entityName = def.name.value
		for (const fieldDef of def.fields ?? []) {
			const { array, nullable, type } = this.unwrapFieldType(fieldDef)
			const scalarType = scalarTypeMapping[type]
			if (scalarType) {
				if (array) {
					throw new Error('array scalars are not supported')
				}
				const column: Model.AnyColumn = {
					name: fieldDef.name.value,
					nullable,
					columnName: this.conventions.getColumnName(fieldDef.name.value),
					type: scalarType,
					columnType: resolveDefaultColumnType(scalarType),
				}
				this.registerField(entityName, column)
			} else if (type in this.enumDefinitions) {
				if (array) {
					throw new Error('array enums are not supported')
				}
				const column: Model.AnyColumn = {
					name: fieldDef.name.value,
					nullable,
					columnName: this.conventions.getColumnName(fieldDef.name.value),
					type: Model.ColumnType.Enum,
					columnType: type,
				}
				this.registerField(entityName, column)
			} else if (type in this.entityDefinitions) {
				this.processRelation({
					typeDef: def,
					fieldDef,
				})
			} else {
				throw new Error(`Invalid type ${type}`)
			}
		}
	}

	private processRelation({ typeDef, fieldDef }: { typeDef: ObjectTypeDefinitionNode; fieldDef: FieldDefinitionNode }) {
		if (this.getEntity(typeDef).fields[fieldDef.name.value]) {
			// already created by other side
			return
		}
		const unwrappedType = this.unwrapFieldType(fieldDef)
		const relationName = fieldDef.name.value

		const targetType = this.entityDefinitions[unwrappedType.type]
		const entityName = typeDef.name.value
		const inversePossibleDefinitions = targetType.fields?.filter(it => {
			const unwrapped = this.unwrapFieldType(it)
			return unwrapped.type === entityName
		}) ?? []
		const createJoiningTable = (inverseSide?: string): Model.JoiningTable => {
			const columnNames = this.conventions.getJoiningTableColumnNames(
				entityName,
				relationName,
				unwrappedType.type,
				inverseSide,
			)
			return {
				tableName: this.conventions.getJoiningTableName(entityName, relationName),
				joiningColumn: { columnName: columnNames[0], onDelete: Model.OnDelete.cascade },
				inverseJoiningColumn: { columnName: columnNames[1], onDelete: Model.OnDelete.cascade },
				eventLog: { enabled: true },
			}

		}
		if (inversePossibleDefinitions.length === 0) {
			if (unwrappedType.array) {
				const joiningTable = createJoiningTable()
				// m:n
				const rel: Model.ManyHasManyOwningRelation = {
					type: Model.RelationType.ManyHasMany,
					name: relationName,
					target: unwrappedType.type,
					joiningTable,
				}
				this.registerField(entityName, rel)
			} else {
				// m:1
				const rel: Model.ManyHasOneRelation = {
					type: Model.RelationType.ManyHasOne,
					name: relationName,
					target: unwrappedType.type,
					nullable: unwrappedType.nullable,
					joiningColumn: {
						columnName: this.conventions.getJoiningColumnName(relationName),
						onDelete: Model.OnDelete.restrict,
					},
				}
				this.registerField(entityName, rel)
			}
			return
		}

		if (inversePossibleDefinitions.length > 1) {
			throw new Error('Cannot resolve other side of relation, multiple possible relations found: ' + inversePossibleDefinitions.map(it => it.name.value).join(', '))
		}

		const targetRelationDef = inversePossibleDefinitions[0]
		const targetRelationType = this.unwrapFieldType(targetRelationDef)
		const targetRelName = targetRelationDef.name.value

		type BaseRelDefinition =
			| Omit<Model.ManyHasManyOwningRelation, 'target' | 'name' >
			| Omit<Model.ManyHasManyInverseRelation, 'target' | 'name' >
			| Omit<Model.OneHasManyRelation, 'target' | 'name' >
			| Omit<Model.ManyHasOneRelation, 'target' | 'name' >
			| Omit<Model.OneHasOneOwningRelation, 'target' | 'name' >
			| Omit<Model.OneHasOneInverseRelation, 'target' | 'name' >

		let thisRel: BaseRelDefinition
		let otherRel: BaseRelDefinition

		if (unwrappedType.array && targetRelationType.array) {
			const joiningTable = createJoiningTable(targetRelationDef.name.value)
			thisRel = { type: Model.RelationType.ManyHasMany, joiningTable, inversedBy: targetRelName }
			otherRel = { type: Model.RelationType.ManyHasMany, ownedBy: relationName }
		} else if (unwrappedType.array && !targetRelationType.array) {
			thisRel = { type: Model.RelationType.OneHasMany, ownedBy: targetRelName }
			otherRel = {
				type: Model.RelationType.ManyHasOne,
				inversedBy: relationName,
				nullable: targetRelationType.nullable,
				joiningColumn: {
					onDelete: Model.OnDelete.restrict,
					columnName: this.conventions.getJoiningColumnName(targetRelName),
				},
			}
		} else if (!unwrappedType.array && targetRelationType.array) {
			thisRel = {
				type: Model.RelationType.ManyHasOne,
				inversedBy: targetRelName,
				nullable: unwrappedType.nullable,
				joiningColumn: {
					onDelete: Model.OnDelete.restrict,
					columnName: this.conventions.getJoiningColumnName(relationName),
				},
			}
			otherRel = { type: Model.RelationType.OneHasMany, ownedBy: relationName }
		} else {
			thisRel = {
				type: Model.RelationType.OneHasOne,
				inversedBy: targetRelName,
				nullable: unwrappedType.nullable,
				joiningColumn: {
					onDelete: Model.OnDelete.restrict,
					columnName: this.conventions.getJoiningColumnName(relationName),
				},
			}
			otherRel = {
				type: Model.RelationType.OneHasOne,
				nullable: targetRelationType.nullable,
				ownedBy: relationName,
			}
		}
		this.registerField(entityName, {
			name: relationName,
			target: unwrappedType.type,
			...thisRel,
		})
		this.registerField(unwrappedType.type, {
			target: entityName,
			name: targetRelName,
			...otherRel,
		})

	}

	private unwrapFieldType(def: FieldDefinitionNode): UnwrappedType {
		let nullable = true
		let array = false
		let type = def.type
		if (type.kind === 'NonNullType') {
			nullable = false
			type = type.type
		}
		if (type.kind === 'ListType') {
			array = true
			type = type.type
			if (type.kind === 'NonNullType') {
				type = type.type
			}
		}
		if (type.kind !== 'NamedType') {
			throw new Error(`Unsupported type: ${def.loc?.source}`)
		}
		return { array, nullable, type: type.name.value }
	}

	private registerField(entityName: string, field: Model.AnyField) {
		const entity = this.getEntity(this.entityDefinitions[entityName])
		;(entity.fields as Writable<Model.Entity['fields']>)[field.name] = field
	}


	private getEntity(def: ObjectTypeDefinitionNode): Model.Entity {
		const entityName = def.name.value
		return this.entities[entityName] ??= {
			name: entityName,
			unique: {},
			indexes: {},
			primary: 'id',
			primaryColumn: 'id',
			tableName: this.conventions.getTableName(entityName),
			eventLog: { enabled: true },
			fields: {
				id: {
					name: 'id',
					columnName: 'id',
					type: Model.ColumnType.Uuid,
					columnType: resolveDefaultColumnType(Model.ColumnType.Uuid),
					nullable: false,
				},
			},
		}
	}
}
