const cp = require('child_process')
const path = require('path')

function getStdout(args) {
    return new Promise((resolve, reject) => {
        cp.exec(`node ${path.join(__dirname, '..', 'index.js')} ${args}`, (error, stdout) => {
            if (error) return reject(error)
            resolve(stdout)
        })
    })
}

jest.setTimeout(10000)

describe('parallel integration', () => {
    let expected
    beforeAll(async () => {
        expected = await getStdout('-P 1 arpa | sort')
        expect(expected.split('\n').length).toBeGreaterThan(20)
    })

    ;[
        2,
        3,
        10,
        36
    ].forEach(n => {
        it(`.arpa is the same with ${n}x parallel`, async () => {
            expect(await getStdout(`-P ${n} arpa | sort`)).toEqual(expected)
        })
    })
})