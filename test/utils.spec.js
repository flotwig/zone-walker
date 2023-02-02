const utils = require('../utils')

describe('normalizeName', () => {
    it('normalizes', () => {
        expect([
            'foo.com',
            'arpa',
            '.arpa',
            'foo.foo.com.'
        ].map(utils.normalizeName)).toEqual([
            'foo.com.',
            'arpa.',
            'arpa.',
            'foo.foo.com.'
        ])
    })
})

describe('incrementName', () => {
    it('increments when a label is max length', () => {
        expect(utils.incrementName(`${'a'.repeat(63)}.com`))
            .toEqual(`${'a'.repeat(62)}b.com`)
    })

    it('increments by adding \\001', () => {
        expect(utils.incrementName('foo.com'))
            .toEqual('foo\001.com')
    })
})

describe('compareName', () => {
    // https://www.rfc-editor.org/rfc/rfc4034#section-6.1
    it('matches RFC 4034 example output', () => {
        const expected = [
            'example',
            'a.example',
            'yljkjljk.a.example',
            'Z.a.example',
            'zABC.a.EXAMPLE',
            'z.example',
            '\001.z.example',
            '*.z.example',
            '\200.z.example'
        ]

        const shuffled = [...expected].sort(() => Math.random() * 2 - 1)

        expect(shuffled.sort(utils.compareName)).toEqual(expected)
    })
})
