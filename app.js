document.addEventListener('DOMContentLoaded', async () => {
    // --------------------------------------------------------
    // Supabase Configuration (維持)
    // --------------------------------------------------------
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';

    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --------------------------------------------------------
    // UI Initialization (Calendar & Players) (維持)
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
    // Core Logic (Calculation)
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

    // 補填計算ロジック（スコア行とCHIP行で共通）
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

        // 各マッチの行を集計
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
            
            if (!hasInput) {
                balCell.innerHTML = "";
            } else if (Math.abs(rowSum) < 0.01) {
                balCell.innerHTML = `<span class="text-gray-400 font-black italic text-[10px]" style="transform:skewX(10deg); display:block;">OK</span>`;
            } else {
                balCell.innerHTML = `<button class="btn-calc" onclick="runCalc(this)">CALC</button>`;
            }

            baseTotals.a += vals[0];
            baseTotals.b += vals[1];
            baseTotals.c += vals[2];
            baseTotals.d += vals[3];
        });

        // CHIP欄の集計とバリデーション
        const chipRow = document.querySelector('.chip-row');
        if (chipRow) {
            const chipInputs = chipRow.querySelectorAll('.chip-in');
            const chipVals = Array.from(chipInputs).map(i => parseFloat(i.value) || 0);
            const hasChipInput = Array.from(chipInputs).some(i => i.value !== "");
            const chipSum = chipVals.reduce((a,b) => a+b, 0);
            const chipBalCell = document.getElementById('chip-bal-cell');

            chipInputs.forEach((input, idx) => {
                const val = chipVals[idx];
                const col = input.dataset.col;
                chipValues[col] = val;

                // スタイル更新（文字色はCSSで白ベースだが、プラスマイナスの色分けを適用）
                input.classList.remove('score-pos', 'score-neg', 'score-zero');
                if (val > 0) input.classList.add('score-pos');
                else if (val < 0) input.classList.add('score-neg');
                else if (input.value !== "") input.classList.add('score-zero');
            });

            if (chipBalCell) {
                if (!hasChipInput) {
                    chipBalCell.innerHTML = "";
                } else if (Math.abs(chipSum) < 0.01) {
                    chipBalCell.innerHTML = `<span class="text-white font-black italic text-[10px]" style="transform:skewX(10deg); display:block;">OK</span>`;
                } else {
                    chipBalCell.innerHTML = `<button class="btn-calc" onclick="runCalc(this)">CALC</button>`;
                }
            }
        }

        // TOTと新ロジックCOINの反映
        ['a','b','c','d'].forEach(id => {
            const total = baseTotals[id] + chipValues[id];
            const tEl = document.getElementById(`tot-${id}`);
            if (tEl) {
                tEl.innerText = total.toFixed(1).replace(/\.0$/, '');
                tEl.style.color = 'var(--p5-white)';
            }

            const cEl = document.getElementById(`coin-${id}`);
            if (cEl) {
                const chip = chipValues[id];
                const coinResult = Math.floor((total * 20) + (chip * 50));
                cEl.innerText = coinResult;
                
                if (coinResult > 0) cEl.style.color = 'var(--p5-yellow)';
                else if (coinResult < 0) cEl.style.color = 'var(--p5-cyan)';
                else cEl.style.color = 'var(--p5-white)';
            }
        });
    }

    // --------------------------------------------------------
    // Submit / Save Logic (維持)
    // --------------------------------------------------------
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        const badge = document.getElementById('status-badge');
        const pIds = ['pA', 'pB', 'pC', 'pD'];
        const names = pIds.map(id => selectedPlayerValues[id]);
        
        if(names.some(n => !n)) {
            alert("⚠️ WARNING: Allies not assembled! Select all players.");
            return;
        }

        if(document.querySelectorAll('.btn-calc').length > 0) {
            if(!confirm("⚠️ CAUTION: Score not balanced. Force submit?")) return;
        }

        try {
            btn.disabled = true;
            btn.querySelector('span').innerText = "SENDING...";
            badge.innerText = "INFILTRATING DATABASE...";

            for(const name of names) {
                await window.sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            }

            const { data: mstr } = await window.sb.from('players').select('id, name').in('name', names);
            const gameDate = document.getElementById('game-date').value;
            const finalTimestamp = new Date().toISOString();
            
            let resultsToInsert = [];
            const rows = document.querySelectorAll('.match-row');
            
            rows.forEach((row, idx) => {
                const inputs = row.querySelectorAll('.score-input');
                const scores = Array.from(inputs).map(i => parseFloat(i.value) || 0);
                if(scores.every(s => s === 0)) return;

                names.forEach((name, pIdx) => {
                    const pid = mstr.find(m => m.name === name)?.id;
                    if(pid) {
                        resultsToInsert.push({
                            game_date: gameDate,
                            game_index: idx + 1,
                            player_id: pid,
                            score: scores[pIdx],
                            created_at: finalTimestamp
                        });
                    }
                });
            });

            const grandTotals = ['a','b','c','d'].map(id => parseFloat(document.getElementById(`tot-${id}`).innerText));
            const coinTotals = ['a','b','c','d'].map(id => parseFloat(document.getElementById(`coin-${id}`).innerText));
            const chips = ['a','b','c','d'].map(id => parseFloat(document.querySelector(`.chip-in[data-col="${id}"]`).value) || 0);

            const summaryData = names.map((name, i) => ({ name, score: grandTotals[i] }));
            const sorted = [...summaryData].sort((a,b) => b.score - a.score);
            
            const summariesToInsert = names.map((name, i) => {
                const pid = mstr.find(m => m.name === name).id;
                const rank = sorted.findIndex(s => s.name === name) + 1;
                return {
                    player_id: pid,
                    player_name: name,
                    total_score: grandTotals[i],
                    coins: coinTotals[i],
                    tips: chips[i], 
                    final_rank: rank,
                    created_at: finalTimestamp,
                    game_date: gameDate
                };
            });

            if(resultsToInsert.length > 0) await window.sb.from('game_results').insert(resultsToInsert);
            await window.sb.from('set_summaries').insert(summariesToInsert);

            badge.innerText = "MISSION COMPLETE";
            btn.style.background = "var(--p5-black)";
            btn.style.color = "var(--p5-yellow)";
            btn.querySelector('span').innerText = "TAKE YOUR TREASURE";
            
            setTimeout(() => { location.href = "history.html"; }, 1000);

        } catch (e) {
            alert("Error: " + e.message);
            btn.disabled = false;
            btn.querySelector('span').innerText = "RETRY";
        }
    };

    document.getElementById('add-row').onclick = window.addMatchRow;
    
    // CHIP入力へのイベントリスナー（バリデーション、フォーカス、ダブルクリック反転）
    document.querySelectorAll('.chip-in').forEach(input => {
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

    await initRoster();
    for(let i=0; i<4; i++) window.addMatchRow();

    // Admin trigger
    let entryTapCount = 0;
    let entryTapTimer;
    const entryTrigger = document.getElementById('admin-trigger');
    if (entryTrigger) {
        entryTrigger.addEventListener('click', () => {
            entryTapCount++;
            clearTimeout(entryTapTimer);
            entryTapTimer = setTimeout(() => { entryTapCount = 0; }, 2000);
            if (entryTapCount === 5) {
                const pass = prompt("PHANTOM THIEF PASSWORD:");
                if (pass === "Gemini") location.href = "admin.html";
            }
        });
    }
});
