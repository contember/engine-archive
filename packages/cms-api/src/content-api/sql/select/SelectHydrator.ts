import Path from './Path'

class SelectHydrator {
	private columns: Path[] = []
	private entities: Path[] = []
	private promises: {
		path: Path
		parentKeyPath: Path
		data: PromiseLike<SelectHydrator.NestedData>
		defaultValue: SelectHydrator.NestedDefaultValue
	}[] = []

	public addEntity(primaryPath: Path) {
		this.entities.push(primaryPath)
	}

	public addColumn(path: Path) {
		this.columns.push(path)
	}

	public addPromise(
		path: Path,
		parentKeyPath: Path,
		data: PromiseLike<SelectHydrator.NestedData>,
		defaultValue: SelectHydrator.NestedDefaultValue
	) {
		this.promises.push({ path, parentKeyPath, data, defaultValue })
	}

	async hydrateGroups(rows: SelectHydrator.Rows, groupBy: string): Promise<SelectHydrator.GroupedObjects> {
		const result: SelectHydrator.GroupedObjects = {}
		for (let row of rows) {
			const key = row[groupBy]
			if (!result[key]) {
				result[key] = []
			}
			result[key].push(await this.hydrateRow(row))
		}
		return result
	}

	async hydrateAll(rows: SelectHydrator.Rows): Promise<SelectHydrator.ResultObjects>
	async hydrateAll(rows: SelectHydrator.Rows, indexBy: string): Promise<SelectHydrator.IndexedResultObjects>

	async hydrateAll(
		rows: SelectHydrator.Rows,
		indexBy?: string
	): Promise<SelectHydrator.ResultObjects | SelectHydrator.IndexedResultObjects> {
		if (indexBy) {
			const result: SelectHydrator.IndexedResultObjects = {}
			for (let row of rows) {
				result[row[indexBy]] = await this.hydrateRow(row)
			}
			return result
		}

		return Promise.all(rows.map(row => this.hydrateRow(row)))
	}

	async hydrateRow(row: SelectHydrator.Row): Promise<SelectHydrator.ResultObject> {
		const result: SelectHydrator.ResultObject = { _meta: {} }
		for (let primaryPath of this.entities) {
			if (row[primaryPath.getAlias()] === null) {
				continue
			}
			primaryPath.path
				.slice(0, primaryPath.path.length - 1)
				.reduce((obj, part) => (obj[part] = obj[part] || { _meta: {} }), result)
		}

		for (let columnPath of this.columns) {
			const path = [...columnPath.path]
			const last: string = path.pop() as string
			const currentObject = path.reduce((obj, part) => (obj && obj[part]) || undefined, result)
			const readable = row[columnPath.getAlias() + SelectHydrator.ColumnFlagSuffixes.readable] !== false
			const updatable = row[columnPath.getAlias() + SelectHydrator.ColumnFlagSuffixes.updatable]

			if (currentObject) {
				currentObject._meta[last] = {
					readable,
					updatable,
				}
				currentObject[last] = readable ? row[columnPath.getAlias()] : null
			}
		}
		for (let { path, parentKeyPath, data, defaultValue } of this.promises) {
			const awaitedData = await data
			const pathTmp = [...path.path]
			const last = pathTmp.pop() as string
			const currentObject = pathTmp.reduce((obj, part) => (obj && obj[part]) || undefined, result)
			const parentValue = row[parentKeyPath.getAlias()]
			if (currentObject && parentValue) {
				currentObject[last] = awaitedData[parentValue] || defaultValue
			}
		}

		return result
	}
}

namespace SelectHydrator {
	export type Row = { [key: string]: any }
	export type Rows = Row[]

	export type ResultObject = { [key: string]: any }
	export type ResultObjects = ResultObject[]
	export type IndexedResultObjects = { [key: string]: ResultObject }
	export type GroupedObjects = { [groupingKey: string]: ResultObjects }
	export type NestedData = GroupedObjects | IndexedResultObjects
	export type NestedDefaultValue = [] | null
	export enum ColumnFlagSuffixes {
		readable = '__readable',
		updatable = '__updatable',
	}
}

export default SelectHydrator