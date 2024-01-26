import { Acl, Input, Model } from '@contember/schema'
import { acceptFieldVisitor, getColumnName } from '@contember/schema-utils'
import { ColumnValueGetter, SelectHydrator, SelectRow } from './SelectHydrator'
import { Path, PathFactory } from './Path'
import { WhereBuilder } from './WhereBuilder'
import { Client, LimitByGroupWrapper, SelectBuilder as DbSelectBuilder } from '@contember/database'
import { OrderByBuilder } from './OrderByBuilder'
import { FieldsVisitorFactory } from './handlers'
import { SelectExecutionHandler, SelectExecutionHandlerContext } from './SelectExecutionHandler'
import { MetaHandler } from './handlers'
import { Mapper } from '../Mapper'
import { FieldNode, ObjectNode } from '../../inputProcessing'
import { assertNever } from '../../utils'
import { PredicateFactory, ThroughAnyRelation, ThroughRoot } from '../../acl'

export class SelectBuilder {
	private resolver: (value: SelectRow[]) => void = () => {
		throw new Error('SelectBuilder: Resolver called too soon')
	}
	public readonly rows: Promise<SelectRow[]> = new Promise(resolve => (this.resolver = resolve))

	private queryWrapper: LimitByGroupWrapper | null = null

	constructor(
		private readonly schema: Model.Schema,
		private readonly whereBuilder: WhereBuilder,
		private readonly orderByBuilder: OrderByBuilder,
		private readonly metaHandler: MetaHandler,
		private qb: DbSelectBuilder<DbSelectBuilder.Result>,
		private readonly hydrator: SelectHydrator,
		private readonly fieldsVisitorFactory: FieldsVisitorFactory,
		private readonly selectHandlers: { [key: string]: SelectExecutionHandler<any> },
		private readonly pathFactory: PathFactory,
		private readonly relationPath: Model.AnyRelationContext[],
		private readonly predicateFactory: PredicateFactory,
	) {}

	public async execute(db: Client): Promise<SelectRow[]> {
		let result: SelectRow[]
		if (this.queryWrapper) {
			result = await this.queryWrapper.getResult(this.qb, db)
		} else {
			result = await this.qb.getResult(db)
		}
		this.resolver(result)
		return result
	}

	public select(
		mapper: Mapper,
		entity: Model.Entity,
		input: ObjectNode<Input.ListQueryInput>,
		path: Path,
		groupBy?: string,
	) {
		this.selectInternal(mapper, entity, path, input)
		const where = input.args.filter
		if (where) {
			this.qb = this.whereBuilder.build(this.qb, entity, path, where, { relationPath: this.relationPath })
		}
		const orderBy = input.args.orderBy || []

		if (groupBy) {
			const groupByColumn = getColumnName(this.schema, entity, groupBy)
			this.queryWrapper = new LimitByGroupWrapper(
				[path.alias, groupByColumn],
				(orderable, qb) => {
					if (orderBy.length > 0) {
						[qb, orderable] = this.orderByBuilder.build(qb, orderable, entity, this.pathFactory.create([]), orderBy)
					}
					return [orderable, qb]
				},
				input.args.offset,
				input.args.limit,
			)
		} else {
			if (orderBy.length > 0) {
				[this.qb] = this.orderByBuilder.build(this.qb, null, entity, path, orderBy)
			}
			this.qb = this.qb.limit(input.args.limit, input.args.offset)
		}
	}

	private selectInternal(mapper: Mapper, entity: Model.Entity, path: Path, input: ObjectNode) {
		if (!input.fields.find(it => it.name === entity.primary && it.alias === entity.primary)) {
			input = input.withField(new FieldNode(entity.primary, entity.primary, {}))
		}

		const predicateAliasMap = new Map<Acl.PredicateDefinition, string>()
		let predicateAliasCounter = 0
		const addPredicate = (predicate: boolean | Acl.PredicateDefinition[]): ColumnValueGetter<boolean> => {
			if (typeof predicate === 'boolean') {
				return () => predicate
			}

			const aliases: string[] = []
			for (const singlePredicate of predicate) {
				let predicateAlias = predicateAliasMap.get(singlePredicate) ?? `predicate_${predicateAliasCounter++}`
				const hasAlias = predicateAliasMap.has(singlePredicate)

				const predicatePath = path.for(predicateAlias)
				aliases.push(predicatePath.alias)

				if (!hasAlias) {
					const relationContext = this.relationPath[this.relationPath.length - 1]

					const primaryPredicate = this.predicateFactory.create(entity, Acl.Operation.read, undefined, relationContext)
					const fieldPredicate = this.predicateFactory.buildPredicates(entity, [singlePredicate], relationContext)

					this.qb = this.whereBuilder.buildAdvanced(
						entity,
						path.back(),
						fieldPredicate,
						apply => this.qb.select(expr =>
							expr.selectCondition(condition => {
								condition = apply(condition)
								if (condition.isEmpty()) {
									return condition.raw('true')
								}
								return condition
							}),
						predicatePath.alias,
						),
						{ relationPath: this.relationPath, evaluatedPredicates: [primaryPredicate] },
					)
					predicateAliasMap.set(singlePredicate, predicateAlias)
				}
			}
			return row => aliases.some(alias => row[alias] === true)
		}

		for (let field of input.fields) {
			const fieldPath = path.for(field.alias)
			const fieldProperty = (() => {
				if (field instanceof ObjectNode) {
					return { objectNode: field }
				}
				if (field instanceof FieldNode) {
					return { fieldNode: field }
				}
				return assertNever(field)
			})()


			const executionContext: SelectExecutionHandlerContext = {
				mapper,
				relationPath: this.relationPath,
				through: this.relationPath[this.relationPath.length - 1].targetRelation?.name ?? (this.relationPath.length > 0 ? ThroughAnyRelation : ThroughRoot),
				addData: async ({ field, dataProvider, defaultValue, predicate }) => {
					if (predicate === false) {
						this.hydrator.addPromise(fieldPath, path.for(field), Promise.resolve({}), defaultValue ?? null)
						return
					}
					const predicateGetter = predicate !== undefined && predicate !== true ? addPredicate(predicate) : null
					const columnName = getColumnName(this.schema, entity, field)
					let ids = await this.getColumnValues(path.for(field), columnName, predicateGetter)

					const data = ids.length > 0 ? dataProvider(ids) : Promise.resolve({})
					this.hydrator.addPromise(fieldPath, path.for(field), data, defaultValue ?? null)
				},
				addColumn: ({ path = fieldPath, predicate, query, valueGetter }) => {
					if (predicate === false) {
						this.hydrator.addColumn(path, () => null)
						return
					}
					const predicateGetter = predicate !== undefined && predicate !== true ? addPredicate(predicate) : null
					if (query) {
						this.qb = query(this.qb)
					}
					this.hydrator.addColumn(
						path,
						valueGetter ?? (row => predicateGetter === null || predicateGetter(row) ? row[path.alias] : null),
					)
				},
				addPredicate: addPredicate,
				path: fieldPath,
				entity: entity,
				...fieldProperty,
			}

			if (field.name === '_meta') {
				this.metaHandler.process(executionContext)
				continue
			}

			// Disregarding __typename field since it's automatically handled by apollo server
			if (field.name === '__typename') {
				continue
			}

			if (field.extensions.extensionKey) {
				const handler = this.selectHandlers[field.extensions.extensionKey]
				if (!handler) {
					throw new Error(`Handler for ${field.extensions.extensionKey} not found`)
				}
				handler.process(executionContext)
				continue
			}

			const fieldVisitor = this.fieldsVisitorFactory.create(mapper, executionContext)
			acceptFieldVisitor(this.schema, entity, field.name, fieldVisitor)
		}
	}

	private async getColumnValues(columnPath: Path, columnName: string, predicateGetter: null | ColumnValueGetter<boolean>): Promise<Input.PrimaryValue[]> {
		this.qb = this.qb.select([columnPath.back().alias, columnName], columnPath.alias)
		const rows = await this.rows
		const filteredRows = predicateGetter === null ? rows : rows.filter(predicateGetter)
		const columnAlias = columnPath.alias
		const ids = filteredRows.map((it): Input.PrimaryValue => it[columnAlias] as Input.PrimaryValue).filter(it => it !== null)
		return Array.from(new Set(ids))
	}
}
