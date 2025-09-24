export default function TestApp() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1>Paramify Test</h1>
      <p>If you see this, React is working!</p>
      <p>Canister ID: {import.meta.env?.VITE_CANISTER_ID_PARAMIFY_INSURANCE || 'Not found'}</p>
    </div>
  );
}