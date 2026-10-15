const fs = require('fs');

const API = 'https://statsapi.mlb.com/api/v1';
const SEASONS = Array.from({ length: 22 }, (_, i) => 2026 - i);

async function fetchSeason(year) {
    const [teamsResponse, standingsResponse] = await Promise.all([
        fetch(`${API}/teams?sportIds=1,11&season=${year}`),
        fetch(`${API}/standings?leagueId=103,104,117,112&season=${year}&standingsTypes=regularSeason`)
    ]);

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

    return Object.values(mlbTeams).map(mlb => {
        const aaa = aaaTeams[mlb.id];
        const mlbRecord = records[mlb.id];
        const aaaRecord = aaa ? records[aaa.id] : null;

        if (!mlbRecord || !aaaRecord || (mlbRecord.wins + mlbRecord.losses === 0) || (aaaRecord.wins + aaaRecord.losses === 0)) {
            return null;
        }

        const mlbPace = +(mlbRecord.pct * 162).toFixed(2);
        const aaaPace = +(aaaRecord.pct * 162).toFixed(2);
        const waaaa = +(mlbPace - aaaPace).toFixed(2);

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
}

(async () => {
    const historyOutput = {};
    for (const year of SEASONS) {
        process.stdout.write(`Fetching ${year}... `);
        const rows = await fetchSeason(year);
        if (rows.length > 0) historyOutput[year] = rows;
        console.log(`done (${rows.length} teams)`);
    }
    fs.writeFileSync('history.json', JSON.stringify(historyOutput));
    console.log('Saved history.json');
})();
