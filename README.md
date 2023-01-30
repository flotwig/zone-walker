# zone-walker

A CLI tool to walk through DNS zones using NSEC responses and enumerate the domains in a zone.

> ⚠️ zone-walker is beta software. Please report any issues encountered.

## Usage

```
Usage: zone-walker [options] <zone>

Walks through DNS zones using NSEC responses and write found domains to stdout.

Arguments:
  zone        zone to traverse, e.g. "arpa."

Options:
  -h, --help  display help for command
```

### Example

```
> zone-walker arpa.
as112.arpa
e164.arpa
home.arpa
in-addr.arpa
in-addr-servers.arpa
[ ... ]
```

## Requirements

* `getdns` library installed locally - on Ubuntu, this requires the `libgetdns-dev` package.

## See Also

* [`zone-walks`](https://github.com/flotwig/zone-walks/) - updated repository of TLD walks created using this tool
* [`ldns-walk`](https://github.com/NLnetLabs/ldns/blob/develop/examples/ldns-walk.c) - similar tool written in C, crashes when walking larger zones
* [`dnsrecon`](https://github.com/darkoperator/dnsrecon) - DNS reconnaisance in Python, supports zone walking, though it doesn't work for TLDs
* [TLDR2's Walkable Zones list](https://github.com/monoidic/TLDR2/blob/master/walkable_zones.md) - updated list of TLDs which allow zone walking
