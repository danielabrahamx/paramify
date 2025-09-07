# Agent Systems Instructions for Paramify Codebase

## Overview
Paramify is a blockchain-based flood insurance protocol that uses real-time USGS water level data to automatically trigger insurance payouts when flood thresholds are exceeded. The system consists of smart contracts (Solidity), a backend service (Node.js), and frontend dashboards (React/TypeScript).

## Project Architecture

<system_components>
<smart_contracts directory="/contracts/">
<contract name="Paramify.sol" type="main">Main insurance contract with dynamic threshold management</contract>
<contract name="MockV3Aggregator.sol" type="oracle">Chainlink-compatible oracle for testing</contract>
<contract name="Lock.sol" type="template">Template contract (can be ignored)</contract>
</smart_contracts>

<backend_service directory="/backend/">
<service name="server.js" type="api">Express API that fetches USGS data and manages oracle updates</service>
<port>3001</port>
<responsibilities>
- Handles USGS API integration and blockchain oracle updates
- Provides REST endpoints for frontend communication
- Manages automatic flood data updates every 5 minutes
</responsibilities>
</backend_service>

<frontend_application directory="/frontend/src/">
<dashboard name="InsuracleDashboard.tsx" type="customer">Customer interface for buying insurance and claiming payouts</dashboard>
<dashboard name="InsuracleDashboardAdmin.tsx" type="admin">Admin interface for threshold management and system administration</dashboard>
<library name="lib/contract.ts" type="config">Contract addresses and ABI definitions</library>
<library name="lib/usgsApi.ts" type="client">API client for backend services</library>
</frontend_application>
</system_components>

## Critical Contract Address Management

<contract_address_warning>
⚠️ IMPORTANT: Contract addresses change on every deployment!
</contract_address_warning>

<address_update_requirements>
When Hardhat is restarted or contracts are redeployed, new addresses are generated. You MUST update:

<backend_config file="/backend/.env">
```
PARAMIFY_ADDRESS=<NEW_CONTRACT_ADDRESS>
MOCK_ORACLE_ADDRESS=<NEW_ORACLE_ADDRESS>
```
</backend_config>

<frontend_config file="/frontend/src/lib/contract.ts">
```typescript
export const PARAMIFY_ADDRESS = '<NEW_CONTRACT_ADDRESS>';
export const MOCK_ORACLE_ADDRESS = '<NEW_ORACLE_ADDRESS>';
```
</frontend_config>
</address_update_requirements>

### Deployment Workflow

<deployment_steps>
<step number="1">Start Hardhat node: `npx hardhat node`</step>
<step number="2">Deploy contracts: `npx hardhat run scripts/deploy.js --network localhost`</step>
<step number="3">Update contract addresses in both backend and frontend</step>
<step number="4">Restart backend service</step>
<step number="5">Frontend will hot-reload automatically</step>
</deployment_steps>

<critical_note>
⚠️ Contract addresses change on EVERY deployment! Always update both backend/.env and frontend/src/lib/contract.ts
</critical_note>

## User Roles & Dashboards

<dashboard_specifications>
<customer_dashboard file="InsuracleDashboard.tsx">
<purpose>End-user interface for flood insurance</purpose>
<features>
<feature>Buy insurance policies (pay premium, set coverage amount)</feature>
<feature>View current flood levels vs. threshold</feature>
<feature>Claim payouts when conditions are met</feature>
<feature>Monitor real-time USGS water data</feature>
</features>
<target_users>Insurance customers</target_users>
<key_functions>
<function>handleBuyInsurance()</function>
<function>handleTriggerPayout()</function>
</key_functions>
</customer_dashboard>

<admin_dashboard file="InsuracleDashboardAdmin.tsx">
<purpose>Insurance company/admin interface</purpose>
<features>
<feature>Manage flood thresholds dynamically</feature>
<feature>Fund the insurance contract</feature>
<feature>Monitor system status and USGS data</feature>
<feature>View contract balances and user policies</feature>
</features>
<access_control>
<admin_wallet>0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</admin_wallet>
<restrictions>Only specific admin wallet has access</restrictions>
</access_control>
<key_functions>
<function>handleUpdateThreshold()</function>
<function>handleFundContract()</function>
</key_functions>
</admin_dashboard>
</dashboard_specifications>

## Data Flow & Unit Conversions

<scaling_system>
<scaling_formula>
<factor>100,000,000,000</factor>
<conversion>Contract Units = Feet × 100,000,000,000</conversion>
<examples>
<example input="4.24 ft" output="424,000,000,000 units"/>
<example input="12 ft" output="1,200,000,000,000 units"/>
</examples>
</scaling_formula>
</scaling_system>

<data_flow>
<data_source order="1" name="USGS API">Real-time water level data in feet</data_source>
<processing order="2" name="Backend Processing">Converts feet to contract units and updates oracle</processing>
<storage order="3" name="Smart Contract">Stores and compares values in contract units</storage>
<display order="4" name="Frontend Display">Converts back to feet for user-friendly display</display>
</data_flow>

## Network Configuration

<network_environments>
<local_development name="Hardhat">
<chain_id>31337</chain_id>
<rpc_url>http://localhost:8545</rpc_url>
<admin_account>0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</admin_account>
<private_key>0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80</private_key>
</local_development>

<github_codespaces>
<rpc_url>https://expert-couscous-4j6674wqj9jr2q7xx-8545.app.github.dev</rpc_url>
<note>Frontend and backend URLs are dynamically generated based on Codespace</note>
</github_codespaces>
</network_environments>

## Common Development Patterns

### When Editing UI Components
- Always maintain consistency between customer and admin dashboards
- Use the same unit conversion patterns across both interfaces
- Ensure responsive design and proper error handling

### When Updating Smart Contracts
1. Make changes to `/contracts/Paramify.sol`
2. Update ABI in `/frontend/src/lib/contract.ts` if needed
3. Redeploy and update addresses
4. Test on both dashboards

### When Modifying Backend APIs
- Update TypeScript interfaces in `/frontend/src/lib/usgsApi.ts`
- Ensure error handling for blockchain connectivity issues
- Test USGS API integration separately

## Testing Workflow

<complete_system_test>
<test_sequence>
<step number="1">Deploy fresh contracts and update addresses</step>
<step number="2">Start backend: `cd backend && npm start` (Linux/macOS) or `cd backend; npm start` (Windows)</step>
<step number="3">Start frontend: `cd frontend && npm run dev` (Linux/macOS) or `cd frontend; npm run dev` (Windows)</step>
<step number="4">Test customer flow: Buy insurance, wait for threshold trigger, claim payout</step>
<step number="5">Test admin flow: Update threshold, fund contract, monitor system</step>
</test_sequence>
</complete_system_test>

<threshold_testing>
<test_parameters>
- Set threshold below current USGS level to trigger payout conditions
- Test with various threshold values (common range: 4-15 feet)
- Verify immediate UI updates after threshold changes
</test_parameters>
</threshold_testing>

## Environment Management

### Required Services
- **Hardhat Node**: Must be running on port 8545
- **Backend Service**: Must be running on port 3001
- **Frontend Dev Server**: Typically port 5173 (Vite) or 3000

### Service Dependencies
- Frontend depends on backend for USGS data
- Backend depends on Hardhat node for blockchain interaction
- All services can gracefully handle temporary disconnections

## Security Considerations

### Access Control
- Only contract owner can update flood threshold
- Admin wallet verification in frontend
- Input validation for all numeric inputs (thresholds, amounts)

### Error Handling
- Always handle blockchain connectivity issues
- Provide user-friendly error messages
- Implement transaction timeout handling
- Graceful degradation when services are unavailable

## Common Issues & Solutions

<troubleshooting_guide>
<critical_issues>
<issue priority="high" category="deployment">
<title>Port Already in Use Errors (EADDRINUSE)</title>
<problem>Backend fails to start with `EADDRINUSE` error on port 3001</problem>
<cause>Previous backend instance still running from earlier deployment attempt</cause>
<symptoms>
- Error: `listen EADDRINUSE: address already in use :::3001`
- Backend service won't start
- Terminal shows port conflict error
</symptoms>
<solution_windows>
<step number="1">Check port usage: `netstat -ano | findstr :3001`</step>
<step number="2">Identify PID from output (rightmost column)</step>
<step number="3">Kill the process: `taskkill /PID <PID_NUMBER> /F`</step>
<step number="4">Restart backend: `cd backend; npm start`</step>
</solution_windows>
<solution_linux_macos>
<step number="1">Check port usage: `lsof -i :3001`</step>
<step number="2">Identify PID from output</step>
<step number="3">Kill the process: `kill -9 <PID_NUMBER>`</step>
<step number="4">Restart backend: `cd backend && npm start`</step>
</solution_linux_macos>
<prevention>Always check for running services before starting new instances. Use background process management tools for development.</prevention>
</issue>

<issue priority="medium" category="deployment">
<title>Frontend Running on Wrong Port</title>
<problem>Frontend starts on port 5173 instead of configured port 8080, or uses alternative ports like 8081</problem>
<cause>Previous frontend instances running or port conflicts causing Vite to choose alternative ports</cause>
<symptoms>
- Frontend accessible on port 5173 instead of 8080
- Vite shows "Local: http://localhost:5173/" instead of 8080
- Alternative ports used (8081, 8082, etc.)
</symptoms>
<solution_windows>
<step number="1">Check what's using port 8080: `netstat -ano | findstr :8080`</step>
<step number="2">Kill any conflicting processes: `taskkill /PID <PID_NUMBER> /F`</step>
<step number="3">Check for other Vite processes: `netstat -ano | findstr :5173`</step>
<step number="4">Kill Vite processes if needed: `taskkill /PID <PID_NUMBER> /F`</step>
<step number="5">Restart frontend: `cd frontend; npm run dev`</step>
<step number="6">Verify running on port 8080: http://localhost:8080/</step>
</solution_windows>
<solution_linux_macos>
<step number="1">Check port usage: `lsof -i :8080`</step>
<step number="2">Kill conflicting processes: `kill -9 <PID_NUMBER>`</step>
<step number="3">Check Vite processes: `lsof -i :5173`</step>
<step number="4">Kill if needed: `kill -9 <PID_NUMBER>`</step>
<step number="5">Restart frontend: `cd frontend && npm run dev`</step>
</solution_linux_macos>
<prevention>Always ensure port 8080 is free before starting frontend. Check vite.config.ts has correct port configuration.</prevention>
</issue>

<issue priority="high" category="deployment">
<title>Contract Address Mismatch After Deployment</title>
<problem>Services fail to connect to contracts after fresh deployment due to outdated addresses</problem>
<cause>Contract addresses change on every Hardhat deployment, but configurations aren't updated</cause>
<solution>
<step number="1">Always run `npx hardhat run scripts/deploy.js --network localhost` to get new addresses</step>
<step number="2">Update `backend/.env` with new PARAMIFY_ADDRESS and MOCK_ORACLE_ADDRESS</step>
<step number="3">Update `frontend/src/lib/contract.ts` with new contract addresses</step>
<step number="4">Restart backend service after address updates</step>
</solution>
<prevention>Make address updates the first step after any contract deployment</prevention>
</issue>
</critical_issues>

<standard_issues>
<issue category="connectivity">
<title>"Contract not found" errors</title>
<solution>
- Verify contract addresses match deployed contracts
- Restart backend service after address updates
- Check Hardhat node is running and accessible
</solution>
</issue>

<issue category="data">
<title>USGS data not updating</title>
<solution>
- Check backend console for API errors
- Verify backend service is running
- Use manual update feature in admin dashboard
</solution>
</issue>

<issue category="wallet">
<title>MetaMask connection issues</title>
<solution>
- Ensure correct network (Chain ID 31337)
- Check account has sufficient ETH for gas
- Verify contract addresses in frontend config
</solution>
</issue>

<issue category="admin">
<title>Threshold updates failing</title>
<solution>
- Confirm admin wallet is connected
- Check backend service connectivity
- Verify input validation (positive numbers, reasonable limits)
</solution>
</issue>

<issue category="ui" date_added="2025-06-25">
<title>UI Display Reverting to Units Instead of Feet</title>
<problem>Admin dashboard flood level occasionally displays raw contract units instead of user-friendly feet format</problem>
<cause>Inconsistent data updates or state management between customer actions and admin dashboard</cause>
<solution>
<step number="1">Ensure both dashboards use the same conversion formula: `(floodLevel / 100000000000).toFixed(2) ft`</step>
<step number="2">Verify state updates are consistent across components</step>
<step number="3">Check that USGS data updates don't override the display format</step>
</solution>
<prevention>Always use the feet display format as primary with units as secondary reference</prevention>
</issue>

<issue category="compatibility" date_added="2025-06-25">
<title>Shell Command Compatibility Issues</title>
<problem>AI agents using wrong shell syntax causing command failures (e.g., using `&&` in PowerShell)</problem>
<cause>Not detecting or asking about user's operating system and shell environment</cause>
<solution>
<step number="1">Always check environment info or ask user about their OS/shell</step>
<step number="2">Use PowerShell syntax for Windows: `cd backend; npm start`</step>
<step number="3">Use Bash syntax for Linux/macOS: `cd backend && npm start`</step>
<step number="4">Provide OS-specific command examples in documentation</step>
</solution>
<prevention>Include OS detection as standard practice for all AI agents</prevention>
</issue>
</standard_issues>
</troubleshooting_guide>

## File Structure Reference

```
/contracts/
├── Paramify.sol              # Main insurance contract
├── mocks/
│   └── MockV3Aggregator.sol  # Test oracle

/backend/
├── server.js                 # Main backend service
└── .env                      # Contract addresses & config

/frontend/src/
├── InsuracleDashboard.tsx         # Customer interface
├── InsuracleDashboardAdmin.tsx    # Admin interface
└── lib/
    ├── contract.ts           # Contract addresses & ABIs
    └── usgsApi.ts           # Backend API client

/scripts/
├── deploy.js                 # Contract deployment
└── deployMock.js            # Oracle deployment

Documentation/
├── THRESHOLD_DEPLOYMENT_GUIDE.md  # Deployment procedures
├── USGS_INTEGRATION_GUIDE.md      # API integration guide
└── AGENT_SYSTEMS_INSTRUCTIONS.md  # This file
```

## Key API Endpoints

### Backend APIs
- `GET /api/health` - Service health check
- `GET /api/status` - Complete system status
- `GET /api/threshold` - Current threshold data
- `POST /api/threshold` - Update threshold (admin only)
- `GET /api/flood-data` - USGS flood data
- `POST /api/manual-update` - Force USGS data refresh

### External APIs
- **USGS**: https://waterservices.usgs.gov/nwis/iv/ (Site: 01646500, Parameter: 00065)

## Development Best Practices

### When Making Changes
1. Always test on both customer and admin dashboards
2. Verify unit conversions are consistent
3. Update relevant documentation
4. Test with both connected and disconnected states
5. Ensure graceful error handling

### Code Consistency
- Use the same scaling factor (100,000,000,000) everywhere
- Maintain consistent error message formatting
- Follow the established TypeScript patterns
- Keep UI components visually consistent

### Git Workflow
- Commit contract address updates separately from feature changes
- Include deployment instructions in commit messages
- Update relevant documentation files with each change

---

## Quick Reference Commands

### Windows (PowerShell)
```powershell
# Start Hardhat node
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Start backend
cd backend; npm start

# Start frontend
cd frontend; npm run dev

# Check contract balances
npx hardhat run scripts/check-balance.js --network localhost
```

### Linux/macOS (Bash)
```bash
# Start Hardhat node
npx hardhat node

# Deploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Start backend
cd backend && npm start

# Start frontend
cd frontend && npm run dev

# Check contract balances
npx hardhat run scripts/check-balance.js --network localhost
```

---

## Instructions for AI Agents: Maintaining This Document

<agent_instructions>
<critical_requirements>
⚠️ IMPORTANT: Any AI agent working on this codebase MUST update this file when they discover:

<mandatory_updates>
1. New bugs or issues not covered in the troubleshooting section
2. Better development patterns or more efficient workflows  
3. Missing critical information that would help future agents
4. Changes to the architecture or new features added
5. Updated dependencies or environment requirements
6. New testing procedures or deployment steps
7. Security considerations not previously documented
</mandatory_updates>
</critical_requirements>

<documentation_workflow>
<section_mapping>
When you discover something new, add it to the appropriate section:
- Bugs/Issues → Add to "Common Issues & Solutions"
- New workflows → Add to "Development Best Practices" or "Testing Workflow"
- Architecture changes → Update "Project Architecture" section
- New APIs/endpoints → Update "Key API Endpoints"
- Environment changes → Update "Environment Management" or "Network Configuration"
</section_mapping>

<standards>
- Use clear, actionable language
- Include code examples where helpful
- Reference specific file paths and line numbers when relevant
- Add timestamps for significant architectural changes
- Maintain the existing formatting and structure
</standards>
</documentation_workflow>

<os_shell_compatibility>
<critical_note>
AI agents MUST detect or ask about the user's operating system and use appropriate commands
</critical_note>

<windows_powershell>
- Use `;` instead of `&&` for command chaining: `cd backend; npm start`
- Use PowerShell-compatible commands and syntax
- File paths use backslashes: `c:\Users\danie\Paramify-1\`
</windows_powershell>

<linux_macos_bash>
- Use `&&` for command chaining: `cd backend && npm start`
- Use Unix-style commands and syntax
- File paths use forward slashes: `/home/user/Paramify-1/`
</linux_macos_bash>

<best_practice>
Always ask the user about their OS/shell at the beginning of a session, or detect from environment info when available.
</best_practice>
</os_shell_compatibility>

<update_pattern_template>
When adding new issues, use this XML-structured format:

```markdown
### [New Issue Title] (Added: 2025-06-25)
**Problem**: Brief description of the issue
**Cause**: Why it happens
**Solution**: Step-by-step fix
**Prevention**: How to avoid in the future
```
</update_pattern_template>

<living_document_principle>
This documentation is a living document that should evolve with the codebase. Your insights help future agents work more efficiently and avoid repeating the same discoveries.
</living_document_principle>
</agent_instructions>

---

This file should be consulted before making any significant changes to the Paramify system. Keep it updated as the project evolves and your discoveries will benefit all future AI agents working on this project.
