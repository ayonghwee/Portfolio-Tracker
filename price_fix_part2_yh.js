// ═══════════════════════════════════════════════════════════════════
// PART 2 — Run this at yhportfoliotracker.vercel.app (console)
// After Part 1 has navigated here with data in window.name
// ═══════════════════════════════════════════════════════════════════

(async function() {
  // ── 1. Read data from window.name ────────────────────────────────
  let state;
  try { state = JSON.parse(window.name); } catch { console.error('❌ No data in window.name. Did Part 1 finish?'); return; }
  const meowPrices = state._prices;
  console.log('Meow data loaded. Policies:', Object.keys(meowPrices).length);
  window.name = ''; // Clear

  // ── 2. Get YH session token ───────────────────────────────────────
  const SESSION_KEY = Object.keys(localStorage).find(k => k.includes('auth-token'));
  const session = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
  const token = session?.access_token;
  if (!token) { console.error('❌ Not logged in to YH'); return; }

  // ── 3. Get all policies from YH ───────────────────────────────────
  const adminUrl = '/api/admin';
  async function admin(action, payload) {
    const r = await fetch(adminUrl, { method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action, payload, access_token: token }) });
    return r.json();
  }

  const { policies } = await admin('list_policies', {});
  // Build map: policyNumber → policyId
  const policyMap = {};
  policies.forEach(p => { policyMap[p.policy_number] = p.id; });
  console.log('YH policies loaded:', policies.length);

  // ── 4. For each policy, get YH transactions and match prices ──────
  let totalUpdates = 0, totalErrors = 0;

  for (const [policyNum, meowTxs] of Object.entries(meowPrices)) {
    const policyId = policyMap[policyNum];
    if (!policyId) { console.warn(`⚠ Policy ${policyNum} not found in YH`); continue; }
    if (!meowTxs.length) continue;

    const { transactions: yhTxs } = await admin('get_transactions', { policy_id: policyId });
    if (!yhTxs?.length) { console.warn(`⚠ No YH transactions for ${policyNum}`); continue; }

    // Build lookup: "date|fund|type" → list of YH transactions
    const yhIndex = {};
    yhTxs.forEach(tx => {
      const key = `${tx.date}|${tx.fund_name}|${tx.type}`;
      if (!yhIndex[key]) yhIndex[key] = [];
      yhIndex[key].push(tx);
    });

    // Find mismatches
    const updates = [];
    meowTxs.forEach(m => {
      const key = `${m.date}|${m.fund}|${m.type}`;
      const matches = yhIndex[key] || [];
      matches.forEach(yhTx => {
        const yhPrice = yhTx.price ? parseFloat(yhTx.price) : null;
        const meowPrice = m.price;
        // Update if missing or differs by more than 0.0001
        if (meowPrice && (yhPrice === null || Math.abs(yhPrice - meowPrice) > 0.0001)) {
          updates.push({ id: yhTx.id, price: meowPrice, _info: `${policyNum} ${m.date} ${m.fund} ${yhPrice}→${meowPrice}` });
        }
      });
    });

    if (!updates.length) {
      console.log(`✓ ${policyNum}: prices already correct`);
      continue;
    }

    console.log(`Updating ${policyNum}: ${updates.length} price fixes`);
    updates.forEach(u => console.log(`  ${u._info}`));

    // Batch update
    const result = await admin('update_transaction_prices', {
      updates: updates.map(u => ({ id: u.id, price: u.price }))
    });

    if (result.ok) {
      console.log(`  ✓ ${updates.length} updated`);
      totalUpdates += updates.length;
    } else {
      console.error(`  ❌ Errors on ${policyNum}:`, result.errors);
      totalErrors += (result.errors?.length || 1);
    }
  }

  console.log('');
  console.log('═══════════════════════════════');
  console.log(`✅ Done. ${totalUpdates} prices updated, ${totalErrors} errors.`);
  console.log('Reload any policy page to see updated prices.');
})();
