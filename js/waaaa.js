const API = 'https://statsapi.mlb.com/api/v1';
const maxYear = Math.max(2026, new Date().getFullYear());
let seasons = Array.from({ length: maxYear - 2005 + 1 }, (_, i) => maxYear - i);

const cache = {};
const params = new URLSearchParams(window.location.search);
const initSeason = Number(params.get('season'));

let defaultSeason = new Date().getMonth() >= 9 ? seasons[0] : seasons[1]; // check if regular season is over (literally just check if it's october)
let currentSeason = seasons.includes(initSeason) ? initSeason : defaultSeason;
let selectedAbbr = params.get('team')?.toUpperCase() || null;
let sortCol = 'waaaa';
let sortAsc = false;

const seasonSelectEl = document.getElementById('season-select');
const statusEl = document.getElementById('status');
const mainViewEl = document.getElementById('main-view');
const plotEl = document.getElementById('plot');
const infoEl = document.getElementById('selected-info');
const tbodyEl = document.getElementById('tbody');
const thEls = document.querySelectorAll('th[data-col]');

thEls.forEach(th => {
    th.dataset.label = th.textContent;
});

function populateDropdown() {
    seasonSelectEl.innerHTML = '';
    seasons.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        seasonSelectEl.appendChild(option);
    });
    seasonSelectEl.value = currentSeason;
}

function syncUrl() {
    const queryParams = new URLSearchParams();
    if (currentSeason !== defaultSeason) queryParams.set('season', currentSeason);
    if (selectedAbbr) queryParams.set('team', selectedAbbr);
    const queryString = queryParams.toString();
    history.replaceState(null, '', queryString ? `?${queryString}` : window.location.pathname);
}

async function loadHistoryJson() {
    try {
        const response = await fetch('history.json');
        if (!response.ok) return;
        const data = await response.json();
        for (const [yearStr, rows] of Object.entries(data)) {
            const year = Number(yearStr);
            if (rows && rows.length > 0) {
                cache[year] = rows;
            } else {
                seasons = seasons.filter(s => s !== year);
            }
        }
    } catch {}
}

async function loadSeason(year) {
    if (cache[year]) return cache[year];

    const [teamsResponse, standingsResponse] = await Promise.all([
        fetch(`${API}/teams?sportIds=1,11&season=${year}`),
        fetch(`${API}/standings?leagueId=103,104,117,112&season=${year}&standingsTypes=regularSeason`)
    ]);

    if (!teamsResponse.ok || !standingsResponse.ok) throw new Error(`HTTP error loading ${year}`);

    const teamsJson = await teamsResponse.json();
    const standingsJson = await standingsResponse.json();

    const mlbTeams = {};
    const aaaTeams = {};

    for (const team of (teamsJson.teams || [])) {
        if (team.sport.id === 1) {
            mlbTeams[team.id] = { id: team.id, name: team.name, abbr: team.abbreviation || team.teamCode?.toUpperCase() };
        } else if (team.sport.id === 11 && team.parentOrgId) {
            aaaTeams[team.parentOrgId] = { id: team.id, name: team.name };
        }
    }

    const records = {};
    for (const recordData of (standingsJson.records || [])) {
        for (const teamRecord of recordData.teamRecords) {
            records[teamRecord.team.id] = {
                wins: teamRecord.wins,
                losses: teamRecord.losses,
                pct: parseFloat(teamRecord.winningPercentage) || 0,
                po: Boolean(teamRecord.clinched)
            };
        }
    }

    const rows = Object.values(mlbTeams).map(mlb => {
        const aaa = aaaTeams[mlb.id];
        const mlbRecord = records[mlb.id];
        const aaaRecord = aaa ? records[aaa.id] : null;

        if (!mlbRecord || !aaaRecord || (mlbRecord.wins + mlbRecord.losses === 0) || (aaaRecord.wins + aaaRecord.losses === 0)) {
            return null;
        }

        const mlbPace = mlbRecord.pct * 162;
        const aaaPace = aaaRecord.pct * 162;
        const waaaa = mlbPace - aaaPace;

        return {
            year,
            mlbName: mlb.name,
            mlbAbbr: mlb.abbr,
            aaaName: aaa.name,
            mlbWins: mlbRecord.wins,
            mlbLosses: mlbRecord.losses,
            mlbPace,
            aaaWins: aaaRecord.wins,
            aaaLosses: aaaRecord.losses,
            aaaPace,
            po: mlbRecord.po,
            waaaa
        };
    }).filter(Boolean);

    if (rows.length > 0) cache[year] = rows;
    return rows;
}

function formatWaaaa(value) {
    return (value > 0 ? '+' : '') + value.toFixed(1);
}

function selectTeam(abbr) {
    selectedAbbr = abbr;
    syncUrl();
    render();
}

function render() {
    const rows = [...(cache[currentSeason] || [])];

    rows.sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (typeof valA === 'string') {
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
    });

    thEls.forEach(th => {
        const col = th.dataset.col;
        const arrow = col === sortCol ? (sortAsc ? ' ▲' : ' ▼') : '';
        th.textContent = th.dataset.label + arrow;
    });

    const width = 540;
    const height = 440;
    const paddingLeft = 48;
    const paddingRight = 28;
    const paddingTop = 24;
    const paddingBottom = 44;

    const paces = rows.flatMap(r => [r.aaaPace, r.mlbPace]);
    const dataMin = paces.length ? Math.min(...paces) : 50;
    const dataMax = paces.length ? Math.max(...paces) : 110;
    const min = Math.min(50, Math.floor((dataMin - 4) / 5) * 5);
    const max = Math.max(110, Math.ceil((dataMax + 4) / 5) * 5);

    const scaleX = val => paddingLeft + ((val - min) / (max - min)) * (width - paddingLeft - paddingRight);
    const scaleY = val => height - paddingBottom - ((val - min) / (max - min)) * (height - paddingTop - paddingBottom);

    let svg = `
        <line x1="${scaleX(81)}" y1="${paddingTop}" x2="${scaleX(81)}" y2="${height - paddingBottom}" stroke="#CCC" stroke-dasharray="3,3"/>
        <line x1="${paddingLeft}" y1="${scaleY(81)}" x2="${width - paddingRight}" y2="${scaleY(81)}" stroke="#CCC" stroke-dasharray="3,3"/>
        <line x1="${scaleX(min)}" y1="${scaleY(min)}" x2="${scaleX(max)}" y2="${scaleY(max)}" stroke="#000" stroke-dasharray="4,4" stroke-width="0.8"/>
        <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="#000"/>
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${height - paddingBottom}" stroke="#000"/>
        <text x="${(paddingLeft + width - paddingRight) / 2}" y="${height - 10}" font-size="11" text-anchor="middle">AAA Affiliate 162-Game Win Pace</text>
        <text x="14" y="${(paddingTop + height - paddingBottom) / 2}" font-size="11" text-anchor="middle" transform="rotate(-90 14,${(paddingTop + height - paddingBottom) / 2})">MLB Win Pace</text>
    `;

    const ticks = [];
    for (let t = Math.ceil(min / 15) * 15; t <= max - 5; t += 15) {
        if (Math.abs(t - 81) > 6) ticks.push(t);
    }
    ticks.push(81);

    ticks.forEach(t => {
        svg += `
            <text x="${scaleX(t)}" y="${height - paddingBottom + 15}" font-size="10" text-anchor="middle">${t}</text>
            <text x="${paddingLeft - 7}" y="${scaleY(t) + 3}" font-size="10" text-anchor="end">${t}</text>
        `;
    });

    const points = rows.map(r => ({
        r,
        x: scaleX(Math.max(min, Math.min(max, r.aaaPace))),
        y: scaleY(Math.max(min, Math.min(max, r.mlbPace)))
    }));

    const candidates = [
        { dx: 6, dy: 3, anchor: 'start', ox: 14, oy: 0 },
        { dx: -6, dy: 3, anchor: 'end', ox: -14, oy: 0 },
        { dx: 0, dy: -7, anchor: 'middle', ox: 0, oy: -9 },
        { dx: 0, dy: 13, anchor: 'middle', ox: 0, oy: 9 },
        { dx: 5, dy: -5, anchor: 'start', ox: 13, oy: -7 },
        { dx: -5, dy: -5, anchor: 'end', ox: -13, oy: -7 },
        { dx: 5, dy: 11, anchor: 'start', ox: 13, oy: 7 },
        { dx: -5, dy: 11, anchor: 'end', ox: -13, oy: 7 }
    ];

    const placedBoxes = [];

    points.forEach(point => {
        const labelWidth = point.r.mlbAbbr.length * 5.8 + 2;
        const labelHeight = 8.5;
        let bestCandidate = candidates[0];
        let bestScore = Infinity;

        candidates.forEach((candidate, index) => {
            const cx = point.x + candidate.ox;
            const cy = point.y + candidate.oy;
            let score = index * 0.4;

            if (cx - labelWidth / 2 < paddingLeft + 2 || cx + labelWidth / 2 > width - paddingRight - 2 || cy - labelHeight / 2 < paddingTop + 2 || cy + labelHeight / 2 > height - paddingBottom - 2) {
                score += 500;
            }

            points.forEach(other => {
                if (other === point) return;
                const ddx = Math.max(0, Math.abs(cx - other.x) - labelWidth / 2);
                const ddy = Math.max(0, Math.abs(cy - other.y) - labelHeight / 2);
                const d2 = ddx * ddx + ddy * ddy;
                if (d2 < 36) score += (36 - d2) * 8;
            });

            placedBoxes.forEach(box => {
                const overlapX = Math.min(cx + labelWidth / 2, box.cx + box.w / 2) - Math.max(cx - labelWidth / 2, box.cx - box.w / 2);
                const overlapY = Math.min(cy + labelHeight / 2, box.cy + box.h / 2) - Math.max(cy - labelHeight / 2, box.cy - box.h / 2);
                if (overlapX > 0 && overlapY > 0) score += overlapX * overlapY * 6;
            });

            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        });

        point.lbl = bestCandidate;
        placedBoxes.push({ cx: point.x + bestCandidate.ox, cy: point.y + bestCandidate.oy, w: labelWidth, h: labelHeight });
    });

    points.sort((a, b) => (a.r.mlbAbbr === selectedAbbr ? 1 : 0) - (b.r.mlbAbbr === selectedAbbr ? 1 : 0));

    points.forEach(({ r, x, y, lbl }) => {
        const isSelected = r.mlbAbbr === selectedAbbr;
        const fill = r.po ? '#5A3A5A' : '#FFFFFF';
        const radius = isSelected ? 5.5 : 3.6;
        const strokeWidth = isSelected ? 2.2 : 1.1;

        svg += `
            <g class="pt" data-abbr="${r.mlbAbbr}" style="cursor:pointer">
                <circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" stroke="#000" stroke-width="${strokeWidth}"/>
                <text x="${x + lbl.dx}" y="${y + lbl.dy}" font-size="8.5" text-anchor="${lbl.anchor}"
                      font-weight="${isSelected ? 'bold' : 'normal'}"
                      fill="${isSelected ? '#5A3A5A' : '#000'}"
                      style="paint-order: stroke; stroke: #FFFFFF; stroke-width: 2.5px; stroke-linejoin: round;">
                    ${r.mlbAbbr}
                </text>
            </g>
        `;
    });

    plotEl.innerHTML = svg;

    const selectedRow = rows.find(r => r.mlbAbbr === selectedAbbr) || rows[0];
    if (selectedRow) {
        infoEl.innerHTML = `<strong>${selectedRow.year} ${selectedRow.mlbName}</strong> (${selectedRow.mlbWins}-${selectedRow.mlbLosses}${selectedRow.po ? '&nbsp;*' : ''}) &mdash; <strong>${selectedRow.aaaName}</strong> (${selectedRow.aaaWins}-${selectedRow.aaaLosses}) &mdash; <strong>WAAAA: ${formatWaaaa(selectedRow.waaaa)}</strong>`;
    }

    tbodyEl.innerHTML = rows.map(r => `
        <tr class="${r.mlbAbbr === selectedAbbr ? 'active-row' : ''}" data-abbr="${r.mlbAbbr}" style="cursor:pointer">
            <td class="nowrap">${r.mlbName}${r.po ? '&nbsp;*' : ''}</td>
            <td class="nowrap">${r.aaaName}</td>
            <td class="nowrap num">${r.mlbWins}-${r.mlbLosses}</td>
            <td class="nowrap num">${r.aaaPace.toFixed(1)}</td>
            <td class="nowrap num"><strong>${formatWaaaa(r.waaaa)}</strong></td>
        </tr>
    `).join('');
}

async function scanHistory() {
    const uncachedSeasons = seasons.filter(y => !cache[y]);
    for (let i = 0; i < uncachedSeasons.length; i += 4) {
        const batch = uncachedSeasons.slice(i, i + 4);
        const results = await Promise.all(batch.map(y => loadSeason(y).catch(() => [])));
        batch.forEach((year, idx) => {
            if (!results[idx] || results[idx].length === 0) {
                seasons = seasons.filter(s => s !== year);
            }
        });
    }
    populateDropdown();

    const allRows = seasons.flatMap(y => cache[y] || []);
    let maxRecord = null;
    let minRecord = null;
    let poRecord = null;

    for (const record of allRows) {
        if (!maxRecord || record.waaaa > maxRecord.waaaa) maxRecord = record;
        if (!minRecord || record.waaaa < minRecord.waaaa) minRecord = record;
        if (record.po && (!poRecord || record.waaaa < poRecord.waaaa)) poRecord = record;
    }

    const bindRecord = (elementId, record) => {
        const element = document.getElementById(elementId);
        if (!record) return;
	if (record.year == maxYear && defaultSeason != maxYear) return; // skip if regular season is not over
        element.textContent = `${record.year} ${record.mlbAbbr} (${formatWaaaa(record.waaaa)})`;
        element.onclick = async (event) => {
            event.preventDefault();
            currentSeason = record.year;
            seasonSelectEl.value = record.year;
            selectedAbbr = record.mlbAbbr;
            syncUrl();
            await loadSeason(currentSeason);
            render();
        };
    };

    bindRecord('rec-max', maxRecord);
    bindRecord('rec-min', minRecord);
    bindRecord('rec-po', poRecord);
}

plotEl.addEventListener('click', (event) => {
    const pt = event.target.closest('.pt');
    if (pt) selectTeam(pt.dataset.abbr);
});

tbodyEl.addEventListener('click', (event) => {
    const tr = event.target.closest('tr[data-abbr]');
    if (tr) selectTeam(tr.dataset.abbr);
});

seasonSelectEl.addEventListener('change', async (event) => {
    currentSeason = Number(event.target.value);
    selectedAbbr = null;
    syncUrl();
    try {
        await loadSeason(currentSeason);
        render();
    } catch {
        statusEl.textContent = 'Failed to load data :(';
        statusEl.style.display = 'block';
    }
});

thEls.forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.col;
        sortAsc = (sortCol === col) ? !sortAsc : false;
        sortCol = col;
        render();
    });
});

(async () => {
    try {
        await loadHistoryJson();

        while (seasons.length > 0) {
            const rows = await loadSeason(seasons[0]).catch(() => []);
            if (rows.length > 0) break;
            seasons.shift();
        }

        defaultSeason = seasons[0];
        if (!seasons.includes(currentSeason)) currentSeason = defaultSeason;

        populateDropdown();
        await loadSeason(currentSeason);

        statusEl.style.display = 'none';
        mainViewEl.style.display = 'grid';
        render();
        scanHistory();
    } catch {
        statusEl.textContent = 'Failed to load data :(';
    }
})();
