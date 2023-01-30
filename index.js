#!/usr/bin/env node

const { program } = require('commander')
const getdns = require('getdns')

program
    .name('zone-walker')
    .description('Walks through DNS zones using NSEC responses and write found domains to stdout.')
    .argument('<zone>', 'zone to traverse, e.g. "arpa."')
    .parse()

const zone = program.args[0]

const context = getdns.createContext({
    resolution_type: getdns.RESOLUTION_RECURSING,
    timeout: 1000,
    return_dnssec_status: true
})

process.on('beforeExit', () => {
    context.destroy()
})

const extensions = {
    dnssec_return_only_secure: true
}

function incrementName(name) {
    // TODO: refine this, could skip some labels?
    // https://www.rfc-editor.org/rfc/rfc4034#section-6
    // https://bert-hubert.blogspot.com/2015/10/how-to-do-fast-canonical-ordering-of.html
    const labels = name.split('.')
    labels[0] = labels[0] + '\001'
    return labels.join('.')
}

function getNsecNextName(name) {
    const incremented = name === zone ? incrementName(`.${name}`) : incrementName(name)
    return new Promise((resolve, reject) => {
        context.general(incremented, getdns.RRTYPE_A, extensions, (err, res) => {
            if (err) {
                console.error('Error getting ' + incremented)
                console.error(err)
                return reject(err)
            }

            if (res.replies_tree.length > 1) {
                console.error('NOTE: multiple in replies_tree for ' + incremented)
            }

            if (!res.replies_tree[0]) {
                console.error(res)
                throw new Error('Missing replies tree for ' + incremented + ' Does this zone use DNSSEC?')
            }

            const nsecs = res.replies_tree[0].authority.filter(record => {
                // TODO: this could probably be made more specific
                return record.type === getdns.RRTYPE_NSEC && record.name.endsWith(name)
            })

            if (!nsecs.length) {
                console.error(res.replies_tree[0].authority)
                return reject(new Error('Missing NSEC on ' + incremented + ', cannot proceed.'))
            }

            if (nsecs.length > 1) {
                console.error(nsecs)
                return reject(new Error('Multiple NSEC on ' + incremented + ', cannot proceed'))
            }

            const nsec = nsecs[0]

            if (!nsec.rdata.next_domain_name) {
                reject(new Error('Missing next_domain_name on ' + incremented + ', cannot proceed'))
            }

            resolve(nsec.rdata.next_domain_name)
        })
    })
}

async function walkZone(zone) {
    let current = zone
    while (current) {
        const nextName = await getNsecNextName(current)
        if (nextName === zone) {
            console.error('Loop detected, ending')
            break
        }
        console.log(nextName.slice(0, -1))
        current = nextName
    }
}

walkZone(zone)
