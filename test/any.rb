Dir.chdir __dir__
data = Marshal.dump eval ARGV[0]
p data
File.write 'a.js', <<~EOF
  const data = #{data.unpack('C*')}
  const array = Uint8Array.from(data)
  const { load } = require('../dist')
  console.dir(load(array.buffer), { depth: null })
EOF
system 'node --enable-source-maps a.js'
File.delete 'a.js'
