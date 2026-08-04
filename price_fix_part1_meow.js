// ═══════════════════════════════════════════════════════════════════
// PART 1 — Run this at cats4life.vercel.app (any page, console)
// It visits all 19 policy pages, extracts transaction prices,
// then navigates to YH with the data in window.name
// ═══════════════════════════════════════════════════════════════════

(function() {
  const POLICIES = [
    '0256337860','0256081716','0252845534','0252800207','0250921069',
    '0246597467','0241859277','0241567701','0236511949','0236043738',
    '0215890909','0215020295','0214600201','0214131662','0213749900',
    '0212448544','0204938752','0202882428','0071847552'
  ];
  const YH = 'https://yhportfoliotracker.vercel.app';

  // Load accumulated state from window.name
  let state = {};
  try { state = JSON.parse(window.name || '{}'); } catch { state = {}; }
  if (!state._prices) state._prices = {};   // { policyNum: [ {date,fund,type,price,units,value}, ... ] }
  if (!state._visited) state._visited = [];

  // ── Extract prices from current page ────────────────────────────
  function extractTransactions() {
    const rows = [];
    // Section VIII tables: each fund has its own <table>
    // Rows: date | description (type) | price | balUnits | units | value | (optional ✕)
    document.querySelectorAll('table').forEach(tbl => {
      const headers = [...tbl.querySelectorAll('thead th')].map(th => th.textContent.trim().toUpperCase());
      const dateIdx  = headers.findIndex(h => h === 'DATE');
      const descIdx  = headers.findIndex(h => h === 'DESCRIPTION');
      const priceIdx = headers.findIndex(h => h === 'PRICE');
      const unitsIdx = headers.findIndex(h => h === 'UNITS');
      const valueIdx = headers.findIndex(h => h === 'VALUE');
      if (priceIdx === -1 || dateIdx === -1) return;

      // Fund name comes from the header row just above the table
      let fundName = '';
      let prev = tbl.previousElementSibling;
      while (prev) {
        const text = prev.textContent.trim();
        if (text.startsWith('GreatLink')) { fundName = text.split('\n')[0].trim(); break; }
        prev = prev.previousElementSibling;
      }
      if (!fundName) {
        // Try parent's previous sibling
        let p = tbl.parentElement;
        while (p && !fundName) {
          const t = p.querySelector('.font-medium, .text-sm');
          if (t && t.textContent.includes('GreatLink')) { fundName = t.textContent.trim(); break; }
          p = p.previousElementSibling;
        }
      }

      tbl.querySelectorAll('tbody tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('td')];
        if (cells.length < 4) return;
        const dateRaw  = cells[dateIdx]?.textContent.trim();
        const type     = cells[descIdx]?.textContent.trim();
        const priceRaw = cells[priceIdx]?.textContent.trim().replace(/,/g,'');
        const unitsRaw = cells[unitsIdx]?.textContent.trim().replace(/[,\-]/g,'');
        const valueRaw = cells[valueIdx]?.textContent.trim().replace(/[$,]/g,'').replace(/−/,'-');

        // Parse date DD/MM/YYYY → YYYY-MM-DD
        const dm = dateRaw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        if (!dm) return;
        const date = `${dm[3]}-${dm[2]}-${dm[1]}`;
        const price = parseFloat(priceRaw);
        if (!isNaN(price) && price > 0) {
          rows.push({ date, fund: fundName, type, price, units: parseFloat(unitsRaw)||null, value: parseFloat(valueRaw)||null });
        }
      });
    });
    return rows;
  }

  // ── Determine which policy page we're on ─────────────────────────
  const pathMatch = location.pathname.match(/\/policy\/(\d+)/);
  if (pathMatch) {
    const pNum = pathMatch[1];
    if (!state._visited.includes(pNum)) {
      const txs = extractTransactions();
      state._prices[pNum] = txs;
      state._visited.push(pNum);
      console.log(`✓ ${pNum}: ${txs.length} transactions extracted`);
    }
  }

  // ── Navigate to next unvisited policy or finish ──────────────────
  const next = POLICIES.find(p => !state._visited.includes(p));
  if (next) {
    console.log(`→ Navigating to policy ${next} (${state._visited.length}/${POLICIES.length} done)`);
    window.name = JSON.stringify(state);
    location.href = `/policy/${next}`;
  } else {
    console.log('✅ All policies extracted. Navigating to YH...');
    console.log('Total policies:', Object.keys(state._prices).length);
    console.log('Total tx records:', Object.values(state._prices).flat().length);
    window.name = JSON.stringify(state);
    location.href = YH;
  }
})();
