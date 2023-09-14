/**
 * Simple, recoverable, intentionally lax parser of postgres DDL subset
 */
export class SqlParser {
	private sql: string = ''
	private position = 0

	public parse(sql: string): Statement[] {
		this.sql = sql.trim()
		this.position = 0
		const statements: Statement[] = []
		let i = 0
		do {
			const stm = this.parseCreateTable() || this.parseAlter()
			if (stm) {
				statements.push(stm)
			} else {
				if (!this.lookahead(/./)) {
					break
				} else {
					if (!this.consumeUntil(';')) {
						break
					}
				}
			}
		} while (i++ < 1000)
		return statements
	}

	private parseCreateTable(): CreateTableStatement | null {
		const createTable = this.consume(/create\s+table(\s+if\s+not\s+exists)?(?=\W)/i)
		if (!createTable) {
			return null
		}
		const tableName = this.consumeName()
		if (!tableName) {
			this.consumeUntil(';')
			return null
		}
		this.consume(/\(/)
		const columns: ColumnDef[] = []
		let i = 0
		let constraints: TableConstraintDef[] | null = null
		do {
			const column = this.parseColumn()
			if (column) {
				columns.push(column)
			}
			if (this.lookahead(/\)/)) {
				break
			}
			constraints = this.parseTableConstraints()
			if (constraints) {
				break
			}
		} while (i++ < 1000)

		this.consume(/\)/)
		this.consume(/;/)

		return {
			type: 'create table',
			columns,
			tableName,
			constraints: constraints ?? [],
		}
	}

	private parseAlter(): AlterTableStatement | null {
		if (!this.consume(/alter\s+table\s+/)) {
			return null
		}
		const tableName = this.consumeName()
		if (!tableName) {
			this.consumeUntil(';')
			return null
		}
		const alters: AlterTableStatement['alters'] = []
		for (let i = 0; i < 1000; i++) {
			if (this.consume(/add(?=\W)/)) {
				if (!this.consume(/column(?=\W)/)) {
					const constraint = this.parseTableConstraint()
					if (constraint) {
						alters.push({ type: 'add constraint', constraint })
					}
				}
				const column = this.parseColumn()
				if (column) {
					alters.push({ type: 'add column', column })
				}
			}
			console.log(this.sql.substring(this.position, this.position + 20))
			console.log(alters)

			if (this.lookahead(/;/)) {
				break
			}
			this.consumeUntil(',')
		}

		this.consumeUntil(';')


		return {
			type: 'alter table',
			tableName,
			alters,
		}
	}



	private parseColumn(): ColumnDef | null {
		const columnName = this.consumeName()
		let columnType = this.consumeName()

		if (!columnType || !columnName) {
			this.consumeRestOfColumnLine()
			return null
		}
		if (columnType === 'double') {
			this.consume(/precision(?=\W)/i)
		}
		if (columnType === 'bit' || columnType === 'character') {
			this.consume(/varying(?=\W)/i)
		}

		const config = this.consume(/\((\d+\s*(,\s*\d+)*)\)/)?.[1].split(',').map(it => parseInt(it.trim(), 10))
		if (columnType === 'time' || columnType === 'timestamp') {
			const tz = this.consume(/(with|without)\s+time\s+zone(?=\W)/i)?.[0].trim().toLowerCase()
			if (tz) {
				columnType += ' ' + tz
			}

		}
		const constraints: ColumnConstraintDef[] = []
		while (true) {
			const initLength = constraints.length
			const hasNotNull = this.consume(/not\s+null(?=\W)/)
			if (hasNotNull) {
				constraints.push({ type: 'not null' })
			}
			const hasNull = this.consume(/null(?=\W)/)
			if (hasNull) {
				constraints.push({ type: 'nullable' })
			}
			const unique = this.consume(/unique(?=\W)/)
			if (unique) {
				const nulls = this.consume(/nulls(\s+not)?\s+distinct(?=\W)/)
				constraints.push({ type: 'unique', nullsNotDistinct: nulls?.[0].includes('not') ? true : undefined })
			}
			const references = this.consume(/references(?=\W)/)
			if (references) {
				const refOptions = this.parseReferenceOptions()
				if (refOptions) {

					constraints.push({
						type: 'references',
						...refOptions,
					})
				}
			}

			if (initLength === constraints.length) {
				break
			}
		}

		this.consumeRestOfColumnLine()

		return {
			name: columnName,
			type: 'column def',
			dataType: {
				type: 'data type def',
				config,
				name: columnType,
			},
			constraints: constraints,
		}
	}

	private parseTableConstraints(): TableConstraintDef[] | null {
		const constraints: TableConstraintDef[] = []
		do {
			const constraint = this.parseTableConstraint()
			if (constraint === false) {
				break
			}
			if (constraint !== null) {
				constraints.push(constraint)
			}
		} while (true)
		return constraints.length ? constraints : null
	}

	private parseTableConstraint(): TableConstraintDef | null | false {
		const constraintNameDef = this.consume(/constraint\s+([\w_]+)/)?.[1] ?? null
		const constraintName = constraintNameDef?.[1]
		if (this.consume(/check\s*\(/)) {
			let nest = 1
			let start = this.position
			for (let i = 0; i < 1000; i++) {
				const char = this.consumeUntil('\\(\\)')
				if (!char) {
					break
				}
				if (char === '(') {
					nest++
				} else if (--nest === 0) {
					break
				}
			}
			this.consumeRestOfColumnLine()

			return {
				type: 'check',
				expression: this.sql.substring(start, this.position),
				constraintName,
			}
		} else if (this.consume(/unique(?=\W)/)) {
			const nulls = this.consume(/nulls(\s+not)?\s+distinct(?=\W)/)
			this.consume(/\(/)
			const columns = this.parseColumnList()

			this.consumeRestOfColumnLine()

			return {
				type: 'unique',
				columns,
				nullsNotDistinct: nulls?.[0].includes('not') ? true : undefined,
				constraintName,
			}
		} else if (this.consume(/primary key(?=\W)/)) {
			this.consume(/\(/)
			const columns = this.parseColumnList()

			this.consumeRestOfColumnLine()

			return {
				type: 'primary key',
				columns,
				constraintName,
			}
		} else if (this.consume(/exclude(?=\W)/)) {

			this.consumeRestOfColumnLine()
			return {
				type: 'exclude',
				constraintName,
			}
		} else if (this.consume(/foreign\s+key(?=\W)/)) {
			this.consume(/\(/)
			const columns = this.parseColumnList()
			this.consume(/\)/)

			this.consume(/references(?=\W)/)

			const refOptions = this.parseReferenceOptions()

			this.consumeRestOfColumnLine()
			if (!refOptions) {
				return null
			}

			return {
				type: 'foreign key',
				constraintName,
				 columns,
				...refOptions,
			}
		}
		return false
	}

	private parseReferenceOptions(): ReferenceConstraintOptions | null {
		const tableName = this.consumeName()
		if (tableName) {
			let columnName = null
			if (this.consume(/\(/)) {
				columnName = this.consumeName()
				this.consume(/\)/)
			}
			const onDelete = this.consume(/on\s+delete\s+(no\s+action|restrict|cascade|set\s+null|set\s+default)(?=\W)/)?.[1].toLowerCase().replace(/\s+/, ' ') as ReferentialAction | undefined
			const onUpdate = this.consume(/on\s+update\s+(no\s+action|restrict|cascade|set\s+null|set\s+default)(?=\W)/)?.[1].toLowerCase().replace(/\s+/, ' ') as ReferentialAction | undefined
			const deferrable = this.consume(/(deferrable|not\s+deferrable)(?=\W)/)?.[1].toLowerCase() === 'deferrable' ?? false
			const initiallyDeferred = this.consume(/(initially\s+deferred|initially\s+immediate)(?=\W)/)?.[1].toLowerCase().includes('deferred') ?? false

			return {
				deferrable,
				initiallyDeferred,
				onDelete,
				onUpdate,
				refTable: tableName,
				refColumn: columnName ?? undefined,
			}
		}
		return null
	}

	private parseColumnList(): string[] {
		const names: string[] = []
		do {
			const name = this.consumeName()
			if (name) {
				names.push(name)
			}
		} while (this.consume(/,/))

		return names
	}

	private consumeRestOfColumnLine() {
		let nest = 0
		do {
			const char = this.consumeUntil('\\(\\),;', false)
			if (!char) {
				return
			}
			if (char === ';') {
				return
			}
			this.consume(/\s+/)

			if (char === '(') {
				nest++
				this.consume(/\(/)
			} else if (nest === 0) {
				if (char === ',') {
					this.consume(/,/)
					return
				}
				return
			} else if (char === ')') {
				nest--
			}

		} while (true)
	}

	private consumeName(): string | null {
		// todo quoted name
		return this.consume(/([\w_]+)\s*/)?.[1] ?? null
	}

	private lookahead(regex: RegExp) {
		return this.sql.substring(this.position).match(new RegExp('^' + regex.source + '\\s*', 'i'))
	}

	private consume(regex: RegExp) {
		const result = this.lookahead(regex)
		this.position += result?.[0].length ?? 0
		return result
	}

	private consumeUntil(char: string, moveIncluding = true): null | string {
		const result = this.consume(new RegExp('[^' + char + ']*([' + char + ']\s*)'))
		if (result) {
			if (!moveIncluding) {
				this.position -= result[1].length
			}
			return result[1].substring(0, 1)
		}
		return null
	}
}

export type Statement =
	| CreateTableStatement
	| AlterTableStatement
	| CreateIndexStatement

export type CreateTableStatement = {
	type: 'create table'
	tableName: string
	columns: ColumnDef[]
	constraints: TableConstraintDef[]
}

export type ColumnDef = {
	type: 'column def'
	name: string
	dataType: DataTypeDef
	constraints: ColumnConstraintDef[]
}

export type ColumnConstraintDef =
	| NotNullConstraintDef
	| NullConstraintDef
	| UniqueConstraintDef
	| PrimaryKeyDef
	| ReferencesConstraintDef
	| DefaultDef

export type NotNullConstraintDef = {
	type: 'not null'
}

export type NullConstraintDef = {
	type: 'nullable'
}

export type PrimaryKeyDef = {
	type: 'primary key'
}
export type UniqueConstraintDef = {
	type: 'unique'
	nullsNotDistinct?: true
}

export type ReferencesConstraintDef = {
	type: 'references'
}
& ReferenceConstraintOptions

export type ReferenceConstraintOptions = {
	refTable: string
	refColumn?: string
	onDelete?: ReferentialAction
	onUpdate?: ReferentialAction
	deferrable?: boolean
	initiallyDeferred?: boolean
}


export type TableConstraintDef =
	| CheckTableConstraintDef
	| UniqueTableConstraintDef
	| PrimaryKeyTableConstraintDef
	| ExcludeTableConstraintDef
	| ForeignKeyTableConstraintDef

export type CheckTableConstraintDef = {
	type: 'check'
	constraintName?: string
	expression: AnyExpression

}
export type UniqueTableConstraintDef = {
	type: 'unique'
	constraintName?: string
	nullsNotDistinct?: true
	columns: string[]

}
export type PrimaryKeyTableConstraintDef = {
	type: 'primary key'
	constraintName?: string
	columns: string[]

}
export type ExcludeTableConstraintDef = {
	type: 'exclude'
	constraintName?: string

}
export type ForeignKeyTableConstraintDef = {
	type: 'foreign key'
	constraintName?: string
	columns: string[]
}
& ReferenceConstraintOptions

export enum ReferentialAction {
	cascade = 'cascade',
	setnull = 'set null',
	setdefault = 'set default',
	restrict = 'restrict',
	noaction = 'no action',
}

export type DefaultDef = {
	type: 'default'
	expression: AnyExpression
}

export type DataTypeDef = {
	type: 'data type def'
	name: string
	quoted?: true
	arrayDims?: number[]
	config?: number[]
}

export type AlterTableStatement = {
	type: 'alter table'
	tableName: string
	alters: (
		| AlterTableAddColumn
		| AlterTableAddConstraint
	)[]
}
export type AlterTableAddColumn = {
	type: 'add column'
	column: ColumnDef
}

export type AlterTableAddConstraint = {
	type: 'add constraint'
	constraint: TableConstraintDef
}

export type CreateIndexStatement = {}

export type AnyExpression = unknown
