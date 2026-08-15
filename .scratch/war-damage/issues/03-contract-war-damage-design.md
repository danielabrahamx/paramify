# 03 — How should the contract represent war damage as a second peril?

Type: grilling
Status: open
Blocked by: 01

## Question

The current contract gates payout on one flood threshold. What's the right shape for war-damage coverage: a separate damage oracle + per-peril policies, a generalized trigger interface, or a new contract? Where does the "instant payout" automation live (backend oracle calling triggerPayout vs. a payout role in the contract)? What are the payout semantics — any confirmed damage pays, or severity-scaled?
