import { build, BuildOptions } from 'esbuild'
import package_ from '../package.json'

const common: BuildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: 'node12',
}

build({
  ...common,
  outfile: package_.jsdelivr,
  globalName: package_.name.split('/').pop(),
})

build({
  ...common,
  outfile: package_.module,
  format: 'esm',
  target: 'esnext',
})

build({
  ...common,
  outfile: package_.main,
  format: 'cjs',
})
