import { Command, CommandConfiguration, Input } from '@contember/cli-common'
import { renderProjectInfoHtml } from '../../lib/project/docs/projectDescribe'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { SchemaLoader } from '../../lib/schema/SchemaLoader'
import { validateSchemaAndPrintErrors } from '../../lib/schema/SchemaValidationHelper'

type Args = {
}

type Options = {
	name?: string
	output?: string
}

export class ProjectGenerateDocumentationCommand extends Command<Args, Options> {
	constructor(
		private readonly schemaLoader: SchemaLoader,
	) {
		super()
	}

	protected configure(configuration: CommandConfiguration<Args, Options>): void {
		configuration.description('Generates HTML documentation from project schema')
		configuration.option('output').valueRequired().description('file name or "-" for stdout')
		configuration.option('name').valueRequired().description('project name (for the title)')
	}

	protected async execute(input: Input<Args, Options>): Promise<number> {
		const schema = await this.schemaLoader.loadSchema()
		if (!validateSchemaAndPrintErrors(schema, 'Defined schema is invalid:')) {
			return 1
		}
		const name = input.getOption('name') ?? 'Contember project'

		const html = await renderProjectInfoHtml(schema, name)
		const output = input.getOption('output') ?? `${name.toLowerCase().replace(/\s+/g, '-')}.html`
		if (output === '-') {
			console.log(html)
		} else {
			console.log(`Documentation saved to ${output}`)
			await writeFile(join(process.cwd(), output), html)
		}

		return 0
	}
}
