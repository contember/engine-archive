export interface MetadataStore<V> {
	get(target: Object, propertyKey?: string | symbol): V
	update(generator: (current: V) => V, target: Object, propertyKey?: string | symbol): void
}

export const createMetadataStore = <V>(initialValue: V): MetadataStore<V> => {
	const map = new WeakMap<Object, Map<string | symbol | undefined, V>>()
	const get = (target: Object, propertyKey?: string | symbol): V => {
		const targetMap = map.get(target)
		if (targetMap?.has(propertyKey)) {
			return targetMap.get(propertyKey) as V
		}
		return initialValue
	}
	return {
		get,
		update: (generator, target, propertyKey) => {
			const targetMap = map.get(target) ?? new Map()
			map.set(target, targetMap)
			targetMap.set(propertyKey, generator(get(target, propertyKey)))
		},
	}
}
