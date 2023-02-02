## Automated QA

Run the Jest tests in this directory via `yarn test`.

## Manual QA

- [ ] Does it work with a TLD that doesn't correctly terminate?
    - `zone-walker gdn --start zz.gdn`
- [ ] Does the initial scan work and does a small zone complete?
    - `zone-walker arpa`
- [ ] Does it work for a non-TLD with no record itself?
    - `zone-walker ns.arpa`
