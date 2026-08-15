# Wayfinder Map — Paramify War-Damage Coverage

## Destination

Paramify covers **parametric insurance for homes damaged by bombing/war** in addition to its current flood coverage — satellite/drone geolocation detects damage, the owner is matched via a government property registry, and payout lands in the owner's account instantly, no claim needed.

## Notes

- Domain: parametric insurance; smart contracts (Solidity, Hardhat); frontend is a Vite React app (`frontend/`); backend Node/Express oracle service (`backend/server.js`).
- Current contract `contracts/Paramify.sol` gates payouts on a single flood threshold (`triggerPayout` requires flood level >= floodThreshold). War-damage is a new peril — expect per-peril or generalized trigger work.
- Demo-first: Danny runs local demos regularly; a working demo path (simulated satellite/drone + gov DB lookup + instant payout) matters as much as production design.
- Skills: /grilling, /domain-modeling for HITL tickets; /research for AFK ones.
- Tracker: local markdown — `.scratch/war-damage/` (GitHub issues disabled on this repo).

## Decisions so far

- _(none yet — frontier below is open)_

## Not yet specified

- Contract design for a second peril: separate damage oracle vs. generalized trigger; how a "bombing confirmed" event is represented on-chain.
- What "instant payout" means operationally: same `triggerPayout` path triggered by the backend oracle, vs. a new automated payout role.
- Which government property registry to use for owner lookup (UK Land Registry? demo mock?) and how registry ID maps to wallet address.
- Satellite/drone damage detection: real data sources (Sentinel, Planet, UNOSAT) vs. demo simulation for the local demo.
- Threshold semantics for war damage: any confirmed structural damage pays, or severity-scaled payouts?

## Out of scope

- _(none ruled out yet)_
