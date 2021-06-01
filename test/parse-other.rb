Dir.chdir __dir__
require 'zlib'

def test_ data, inject=''
  data = Marshal.dump data
  p data
  File.write 'a.js', <<~EOF
    const data = #{data.unpack('C*')}
    const array = Uint8Array.from(data)
    const { load } = require('../dist')
    console.dir(load(array.buffer#{inject}), { depth: null })
  EOF
  system 'node --enable-source-maps a.js'
  File.delete 'a.js'
end

def test_scripts script
  data = [[ rand(1<<16), 'Main', Zlib.deflate(script) ]]
  test_ data, ', { decodeString: false, wrapString: true }'
end

test_scripts 'p "Hello, world!"'
