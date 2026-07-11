import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const src = join(root, 'src')
const allowed = [
  'src/data/austinJurisdiction',
  'src/data/austinPermittedUses',
  'src/data/jurisdictions/austin/',
  'src/data/jurisdictions/defaultPacks.ts',
]

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const violations = []
for (const path of files(src)) {
  const name = relative(root, path)
  if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || allowed.some((prefix) => name.startsWith(prefix))) continue
  const source = readFileSync(path, 'utf8')
  source.split(/\r?\n/).forEach((line, index) => {
    if (/from\s+['"][^'"]*austin|AustinProposedUse|assessAustinProposedUse|AUSTIN_/i.test(line)) {
      violations.push(`${name}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (violations.length) {
  console.error('Austin-specific jurisdiction logic leaked into shared runtime code:')
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('National architecture guard passed: jurisdiction-specific logic is isolated behind packs.')
