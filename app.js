document.addEventListener('DOMContentLoaded', async () => {
    // --------------------------------------------------------
    // Supabase Configuration
    // --------------------------------------------------------
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';

    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --------------------------------------------------------
    // UI Initialization
    // --------------------------------------------------------
    flatpickr("#game-date", {
        dateFormat: "Y-m-d",
        defaultDate: "today",
        disableMobile: "true",
        onReady: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add("p5-calendar");
        }
    });

    let allPlayers = []; 
    let activeTargetId = null; 
    const selectedPlayerValues = { pA: "", pB: "", pC: "", pD: "" };

    async function initRoster() {
        try {
            const { data: players, error } = await window.sb.from('players').select('name');
            if(error) throw error;
            allPlayers = (players || []).map(p => p.name);
        } catch(e) {
            console.error("Roster Load Error:", e);
        }
    }

    window.openPlayerSelector = (targetId) => {
        activeTargetId = targetId;
        const listEl = document.getElementById('modal-player-list');
        listEl.innerHTML = ''; 

        allPlayers.forEach(name => {
            const btn = document.createElement('button');
            btn.className = "w-full py-4 px-6 text-left text-xl font-bold bg-white text-black transform -skew-x-12 hover:bg-red-600 hover:text-white transition-all border-l-8 border-transparent hover:border-black mb-1";
            btn.innerHTML = `<span class="block transform skew-x(12deg)">${name.toUpperCase()}</span>`;
            btn.onclick = () => selectPlayer(name);
            listEl.appendChild(btn);
        });

        const addBtn = document.createElement('button');
        addBtn.className = "w-full py-3 px-6 text-left text-sm font-bold bg-gray-800 text-gray-400 transform -skew-x-12 mt-4";
        addBtn.innerHTML = `<span class="block transform skew-x(12deg)">+ NEW RECRUIT</span>`;
        addBtn.onclick = () => {
            const newName = prompt("ENTER CODE NAME:");
            if (newName) {
                if(!allPlayers.includes(newName)) allPlayers.push(newName);
                selectPlayer(newName);
            }
        };
        listEl.appendChild(addBtn);
        document.getElementById('player-modal').classList.remove('hidden');
    };

    function selectPlayer(name) {
        selectedPlayerValues[activeTargetId] = name;
        const displayEl = document.getElementById(`${activeTargetId}-display`);
        displayEl.innerText = name.toUpperCase();
        displayEl.style.color = 'var(--p5-red)';
        window.closePlayerSelector();
    }

    window.closePlayerSelector = () => {
        document.getElementById('player-modal').classList.add('hidden');
    };

    // --------------------------------------------------------
    // Calculation Logic
    // --------------------------------------------------------
    let rowCount = 0;

    window.addMatchRow = function() {
        rowCount++;
        const tbody = document.getElementById('table-body');
        const tr = document.createElement('tr');
        tr.className = 'match-row';
        tr.innerHTML = `
            <td class="text-center font-bold bg-gray-200" style="color:black;">
                <span>${rowCount}</span>
            </td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="a"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="b"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="c"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="d"></td>
            <td class="bal-cell text-center flex items-center justify-center"></td>
        `;
        tbody.appendChild(tr);

        tr.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updateTotals);
            input.addEventListener('focus', function() { this.select(); });
            input.addEventListener('dblclick', function() {
                const val = parseFloat(this.value) || 0;
                if(val !== 0) {
                    this.value = (val * -1);
                    updateTotals();
                }
            });
        });
    };

    window.runCalc = (btn) => {
        const row = btn.closest('tr');
        const inputs = Array.from(row.querySelectorAll('input'));
        const emptyInputs = inputs.filter(i => i.value === "");
        const target = emptyInputs.length > 0 ? emptyInputs[0] : inputs[3];
        
        let otherSum = 0;
        inputs.forEach(i => {
            if (i !== target) {
                otherSum += parseFloat(i.value) || 0;
            }
        });
        target.value = -otherSum;
        updateTotals();
    };

    function updateTotals() {
        let baseTotals = { a:0, b:0, c:0, d:0 };
        let chipValues = { a:0, b:0, c:0, d:0 };

        document.querySelectorAll('.match-row').forEach(row => {
            const inputs = row.querySelectorAll('.score-input');
            const vals = Array.from(inputs).map(i => parseFloat(i.value) || 0);
            
            inputs.forEach(input => {
                const val = parseFloat(input.value) || 0;
                input.classList.remove('score-pos', 'score-neg', 'score-zero');
                if (val > 0) input.classList.add('score-pos');
                else if (val < 0) input.classList.add('score-neg');
                else if (input.value !== "") input.classList.add('score-zero');
            });

            const hasInput = Array.from(inputs).some(i => i.value !== "");
            const rowSum = vals.reduce((a,b) => a+b, 0);
            const balCell = row.querySelector('.bal-cell');
            
            if (!hasInput) { balCell.innerHTML = ""; }
            else if (Math.abs(rowSum) < 0.01) {
                balCell.innerHTML = `<span class="text-gray-400 font-black italic text-[10px]" style="transform:skewX(10deg); display:block;">OK</span>`;
            } else {
                balCell.innerHTML = `<button class="btn-calc" onclick="runCalc(this)">CALC</button>`;
            }
            baseTotals.a += vals[0]; baseTotals.b += vals[1]; baseTotals.c += vals[2]; baseTotals.d += vals[3];
        });

        const chipInputs = document.querySelectorAll('.tip-in');
        let chipSum = 0;
        chipInputs.forEach(input => {
            const val = parseFloat(input.value) || 0;
            const col = input.dataset.col;
            chipValues[col] = val;
            chipSum += val;
        });
        const tipBalCell = document.getElementById('tip-bal-cell');
        if (Math.abs(chipSum) < 0.01) {
            tipBalCell.innerHTML = `<span class="text-white font-black italic text-[10px]">OK</span>`;
        } else {
            tipBalCell.innerHTML = `<span class="text-red-500 font-black italic text-[10px]">ERR</span>`;
        }

        ['a','b','c','d'].forEach(id => {
            const scoreTotal = baseTotals[id]; 
            const chipVal = chipValues[id];
            const tEl = document.getElementById(`tot-${id}`);
            if (tEl) tEl.innerText = scoreTotal.toFixed(1).replace(/\.0$/, '');

            const cEl = document.getElementById(`coin-${id}`);
            if (cEl) {
                const coinResult = Math.floor((scoreTotal * 20) + (chipVal * 50));
                cEl.innerText = coinResult;
                if (coinResult > 0) cEl.style.color = 'var(--p5-yellow)';
                else if (coinResult < 0) cEl.style.color = 'var(--p5-cyan)';
                else cEl.style.color = 'var(--p5-white)';
            }
        });
    }

    // --------------------------------------------------------
    // Submit Logic (Fixed for Array Type Columns)
    // --------------------------------------------------------
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        const badge = document.getElementById('status-badge');
        const names = ['pA', 'pB', 'pC', 'pD'].map(id => selectedPlayerValues[id]);
        
        if(names.some(n => !n)) {
            alert("⚠️ WARNING: Allies not assembled!");
            return;
        }

        try {
            btn.disabled = true;
            btn.querySelector('span').innerText = "SENDING...";
            badge.innerText = "INFILTRATING DATABASE...";

            // 1. プレイヤー登録
            for(const name of names) {
                await window.sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            }
            const { data: mstr } = await window.sb.from('players').select('id, name').in('name', names);

            const gameDate = document.getElementById('game-date').value;
            const finalTimestamp = new Date().toISOString();

            // 2. gamesテーブル (player_names は配列型として送信)
            const { data: gameRecord, error: gError } = await window.sb.from('games').insert([{
                game_date: gameDate,
                player_names: names, // ★修正: 文字列変換せず配列のまま送る
                created_at: finalTimestamp
            }]).select();
            if(gError) throw gError;
            const gameId = gameRecord[0].id;

            // 3. game_resultsテーブル
            let resultsToInsert = [];
            document.querySelectorAll('.match-row').forEach((row, idx) => {
                const inputs = row.querySelectorAll('.score-input');
                const scores = Array.from(inputs).map(i => parseFloat(i.value) || 0);
                if(scores.every(s => s === 0)) return;
                const sortedScores = [...scores].sort((a, b) => b - a);
                names.forEach((name, pIdx) => {
                    const pid = mstr.find(m => m.name === name)?.id;
                    resultsToInsert.push({
                        game_id: gameId,
                        player_id: pid,
                        player_name: name,
                        score: scores[pIdx],
                        rank: sortedScores.indexOf(scores[pIdx]) + 1,
                        created_at: finalTimestamp
                    });
                });
            });
            if(resultsToInsert.length > 0) {
                const { error: rError } = await window.sb.from('game_results').insert(resultsToInsert);
                if(rError) throw rError;
            }

            // 4. set_summariesテーブル
            const summariesToInsert = names.map((name, i) => {
                const colId = ['a','b','c','d'][i];
                const totalScore = parseFloat(document.getElementById(`tot-${colId}`).innerText);
                const coinTotal = parseInt(document.getElementById(`coin-${colId}`).innerText);
                const chipVal = parseInt(document.querySelector(`.tip-in[data-col="${colId}"]`).value) || 0;
                
                return {
                    game_id: gameId,
                    player_id: mstr.find(m => m.name === name).id,
                    player_name: name,
                    total_score: totalScore,
                    coins: coinTotal,
                    tips: chipVal,
                    final_rank: 0, // 下記で計算
                    created_at: finalTimestamp
                };
            });

            // ランク計算
            const sortedSummaries = [...summariesToInsert].sort((a, b) => b.total_score - a.total_score);
            summariesToInsert.forEach(s => {
                s.final_rank = sortedSummaries.findIndex(ss => ss.player_name === s.player_name) + 1;
            });

            const { error: sError } = await window.sb.from('set_summaries').insert(summariesToInsert);
            if(sError) throw sError;

            // 5. action_logsテーブル (player_names は配列型)
            const { error: lError } = await window.sb.from('action_logs').insert([{
                action_type: 'game_save',
                player_names: names, // ★修正: 配列のまま送る
                details: `Game ID: ${gameId} saved`,
                target_game_id: gameId,
                created_at: finalTimestamp
            }]);
            if(lError) console.error("Log Error:", lError);

            badge.innerText = "MISSION COMPLETE";
            setTimeout(() => { location.href = "history.html"; }, 1000);

        } catch (e) {
            console.error("Save Error:", e);
            alert("Error: " + e.message);
            btn.disabled = false;
            btn.querySelector('span').innerText = "RETRY";
        }
    };

    document.getElementById('add-row').onclick = window.addMatchRow;
    document.querySelectorAll('.tip-in').forEach(input => {
        input.addEventListener('input', updateTotals);
    });

    await initRoster();
    for(let i=0; i<4; i++) window.addMatchRow();
});
