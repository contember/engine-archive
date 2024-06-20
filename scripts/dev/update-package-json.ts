import * as fs from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const packages = [
	...fs.readdirSync(join(root, 'packages')).map(it => `ee/${it}`),
	...fs.readdirSync(join(root, 'packages')).map(it => `packages/${it}`),
]

const updatePackageJson = (packageJson: any, packageDir: string) => {
	if (packageJson.scripts.build) {
		console.log(`${packageDir}: ${packageJson.scripts.build}`)
	}
	return {
		...packageJson,
		scripts: {
			...packageJson.scripts,
			"build": "yarn build:js:dev && yarn build:js:prod",
			"build:js:dev": "NODE_ENV=development vite build --mode development",
			"build:js:prod": "vite build --mode production",
		}
	}
}

packages.forEach(packageDir => {
	const packageJsonPath = join(root, packageDir, 'package.json')
	if (!fs.existsSync(packageJsonPath)) {
		return
	}
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
	const updatedPackageJson = updatePackageJson(packageJson, packageDir)

	// write
	fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, '  ') + '\n')
})
