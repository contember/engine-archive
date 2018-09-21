import { Input, Model } from 'cms-common'
import { getTargetEntity } from '../../content-schema/modelUtils'
import { isUniqueWhere } from '../../content-schema/inputUtils'

export default class UniqueWhereExpander {
	constructor(private readonly schema: Model.Schema) {}

	expand(entity: Model.Entity, where: Input.UniqueWhere): Input.Where {
		if (!isUniqueWhere(entity, where)) {
			throw new Error('Unique where is not unique')
		}

		const whereExpanded: Input.Where = {}
		for (const field in where) {
			const target = getTargetEntity(this.schema, entity, field)
			if (!target) {
				whereExpanded[field] = { eq: where[field] }
			} else {
				whereExpanded[field] = { [target.primary]: { eq: where[field] } }
			}
		}

		return whereExpanded
	}
}