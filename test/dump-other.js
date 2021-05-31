process.chdir(__dirname)
const { dump, RubyObject, RubyHash, pairsFromObject } = require('../dist')
const fs = require('fs')
const { spawnSync } = require('child_process')

function test_(value) {
  console.log(value)
  const data = dump(value)
  console.log(Buffer.from(data).toString('hex'))
  fs.writeFileSync('a.data', Buffer.from(data))
  fs.writeFileSync('a.rb', `pp Marshal.load IO.binread 'a.data'`)
  spawnSync('ruby a.rb', { stdio: 'inherit', shell: true })
  fs.unlinkSync('a.rb')
  fs.unlinkSync('a.data')
}

function test_hash(obj) {
  test_(RubyHash.from(obj))
}

function test_object(obj) {
  test_(new RubyObject(Symbol.for('Object'), {
    instanceVariables: pairsFromObject(obj)
  }))
}

test_hash({
  a: "hello, world!",
  b: [Math.PI]
})

test_object({
  '@a': true
})
