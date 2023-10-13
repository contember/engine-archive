import { Model } from '@contember/schema'
import { NamingConventions, resolveDefaultColumnType } from '@contember/schema-utils'

export class SchemaPartsFactory {
	constructor(
		private namingConventions: NamingConventions,
	) {
	}

	public createEntity(entity: { name: string } & Partial<Omit<Model.Entity, 'name'>>): Model.Entity {
		return {
			primary: 'id',
			primaryColumn: 'id',
			tableName: this.namingConventions.getTableName(entity.name),
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
			indexes: [],
			eventLog: { enabled: true },
			...entity,
		}
	}

	public createColumn(column: CreateColumnInput): Model.AnyColumn {
		return {
			columnType: column.type === Model.ColumnType.Enum ? column.columnType : resolveDefaultColumnType(column.type),
			nullable: true,
			columnName: this.namingConventions.getColumnName(column.name),
			...column,
		}
	}
}


type RestPartial<E, K extends keyof E> = Pick<E, K> & Partial<Omit<E, K>>

export type CreateColumnInput =
	| RestPartial<Model.AnyColumn<Exclude<Model.ColumnType, Model.ColumnType.Enum>>, 'name' | 'type'>
	| RestPartial<Model.AnyColumn<Model.ColumnType.Enum>, 'name' | 'type' | 'columnType'>
