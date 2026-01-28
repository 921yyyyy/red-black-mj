document.addEventListener('DOMContentLoaded', async () => {
    // --------------------------------------------------------
    // Supabase Configuration
    // --------------------------------------------------------
    const SUPABASE_URL = 'https://zekfibkimvsfbnctwzti.supabase.co';
    // User provided Anon Key
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpla2ZpYmtpbXZzZmJuY3R3enRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1ODU5NjYsImV4cCI6MjA4NDE2MTk2Nn0.AjW_4HvApe80USaHTAO_P7WeWaQvPo3xi3cpHm4hrFs';

    // グローバルスコープにsupabaseクライアントを確保
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // --------------------------------------------------------
    // UI Initialization
    // --------------------------------------------------------
    // 日付の初期値設定
    const dateInput = document.getElementById('game-date');
     flatpickr("#game-date", {
        dateFormat: "Y-m-d",
        defaultDate: "today",
        disableMobile: "true", // これによりOS標準のUIではなく、カスタムUIが常に開きます
        onReady: function(selectedDates, dateStr, instance) {
            instance.calendarContainer.classList.add("p5-calendar");
        }
    });

    // TomSelectの初期化
    let playerSelects = {};
    async function initRoster() {
        try {
            const { data: players, error } = await window.sb.from('players').select('name');
            if(error) throw error;

            const options = (players || []).map(p => ({ value: p.name, text: p.name }));
            ['pA', 'pB', 'pC', 'pD'].forEach(id => {
                playerSelects[id] = new TomSelect(`#${id}`, {
                    options: options,
                    create: true,
                    placeholder: 'SELECT',
                    maxItems: 1
                });
            });
        } catch(e) {
            console.error("Roster Load Error:", e);
        }
    }

    // --------------------------------------------------------
    // Core Logic (Calculation)
    // --------------------------------------------------------
    let rowCount = 0;

    // 行追加関数
    window.addMatchRow = function() {
        rowCount++;
        const tbody = document.getElementById('table-body');
        const tr = document.createElement('tr');
        tr.className = 'match-row';
        tr.innerHTML = `
            <td class="text-center font-bold bg-gray-200" style="transform:skewX(-10deg); color:black;">
                <span style="display:block; transform:skewX(10deg);">${rowCount}</span>
            </td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="a"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="b"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="c"></td>
            <td><input type="number" inputmode="decimal" class="score-input" data-col="d"></td>
            <td class="bal-cell text-center font-mono text-xs font-bold pt-3">0</td>
        `;
        tbody.appendChild(tr);

        // 新しいInputにイベントリスナー付与
        tr.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updateTotals);
            input.addEventListener('focus', function() { this.select(); }); // P5っぽく全選択
        });
    };

    // 合計計算ロジック
    function updateTotals() {
        let grandTotals = { a:0, b:0, c:0, d:0 };
        let coinTotals = { a:0, b:0, c:0, d:0 };

        // 1. 各試合(行)の計算
        document.querySelectorAll('.match-row').forEach(row => {
            const inputs = row.querySelectorAll('.score-input');
            const vals = Array.from(inputs).map(i => parseFloat(i.value) || 0);
            
            // 行のバランスチェック
            const rowSum = vals.reduce((a,b) => a+b, 0);
            const balCell = row.querySelector('.bal-cell');
            balCell.textContent = rowSum;
            
            // P5風のエラー表示切り替え
            if(rowSum !== 0) {
                balCell.classList.add('bal-ng');
                balCell.classList.remove('bal-ok');
            } else {
                balCell.classList.remove('bal-ng');
                balCell.classList.add('bal-ok');
            }

            // ウマオカ等の計算ロジック（MLB版を踏襲）
            // 入力値自体がスコア（例: +50, -10等）と仮定し、そのまま加算
            grandTotals.a += vals[0];
            grandTotals.b += vals[1];
            grandTotals.c += vals[2];
            grandTotals.d += vals[3];

            // コイン(Coin)計算ロジック
            // ルール: 1位+3枚, 2位+1枚, 3位-1枚, 4位-3枚
            // 同点時の処理は簡易的に実装（同点なら上位のコインを付与するなど要調整だが、一旦MLB版の挙動: 単純ソート）
            const scores = [
                { id:'a', val: vals[0] },
                { id:'b', val: vals[1] },
                { id:'c', val: vals[2] },
                { id:'d', val: vals[3] }
            ];
            // 降順ソート
            scores.sort((x,y) => y.val - x.val);
            
            // 全員0点（未入力）の場合はコイン変動なしとする
            const isAllZero = vals.every(v => v === 0);
            
            if (!isAllZero) {
                // 順位に応じたコイン変動マップ
                const coinMap = [3, 1, -1, -3];
                scores.forEach((p, idx) => {
                    coinTotals[p.id] += coinMap[idx];
                });
            }
        });

        // 2. チップ(Tips)の加算
        // Tips入力欄の取得
        const tipInputs = document.querySelectorAll('.tip-in');
        let tipSum = 0;
        tipInputs.forEach(input => {
            const col = input.dataset.col; // a,b,c,d
            const val = parseFloat(input.value) || 0;
            grandTotals[col] += val; // 合計スコアに加算
            tipSum += val;
        });

        // Tipsバランスチェック
        const tipBalCell = document.getElementById('tip-bal-cell');
        tipBalCell.innerText = tipSum;
        if(tipSum !== 0) {
            tipBalCell.classList.add('bal-ng');
        } else {
            tipBalCell.classList.remove('bal-ng');
        }

        // 3. DOMへの反映
        ['a','b','c','d'].forEach(id => {
            // トータルスコア
            const tEl = document.getElementById(`tot-${id}`);
            tEl.innerText = grandTotals[id].toFixed(1).replace(/\.0$/, ''); // 整数なら.0消す
            // 色変え
            if(grandTotals[id] > 0) tEl.style.color = '#3b82f6'; // Blue
            else if(grandTotals[id] < 0) tEl.style.color = '#ef4444'; // Red (P5 background is black, so red text is okay if bright enough)
            else tEl.style.color = 'var(--p5-yellow)';

            // コイン
            const cEl = document.getElementById(`coin-${id}`);
            cEl.innerText = coinTotals[id];
            // コインの色は固定（黄色）だが、マイナスなら赤くするか？
            // P5風なら黄色維持が見やすい
        });
    }

    // --------------------------------------------------------
    // Submit / Save Logic
    // --------------------------------------------------------
    document.getElementById('submit-btn').onclick = async () => {
        const btn = document.getElementById('submit-btn');
        const badge = document.getElementById('status-badge');
        
        // バリデーション
        // 1. プレイヤー名
        const pIds = ['pA', 'pB', 'pC', 'pD'];
        const names = pIds.map(id => playerSelects[id].getValue());
        if(names.some(n => !n)) {
            alert("⚠️ WARNING: Player name required!");
            return;
        }
        // 2. バランス
        if(document.querySelectorAll('.bal-ng').length > 0) {
            if(!confirm("⚠️ CAUTION: Score not balanced. Force submit?")) return;
        }

        try {
            btn.disabled = true;
            btn.querySelector('span').innerText = "SENDING...";
            badge.innerText = "INFILTRATING DATABASE...";

            // 1. プレイヤーマスタ登録 (Upsert)
            for(const name of names) {
                await window.sb.from('players').upsert({ name: name }, { onConflict: 'name' });
            }

            // 2. ID取得
            const { data: mstr } = await window.sb.from('players').select('id, name').in('name', names);
            
            // 3. Game Results (各試合明細) 保存
            const gameDate = document.getElementById('game-date').value;
            const finalTimestamp = new Date().toISOString();
            
            // Match Rowsのデータを収集
            let resultsToInsert = [];
            const rows = document.querySelectorAll('.match-row');
            
            rows.forEach((row, idx) => {
                const inputs = row.querySelectorAll('.score-input');
                const scores = Array.from(inputs).map(i => parseFloat(i.value) || 0);
                
                // 全員0点ならスキップ（空行）
                if(scores.every(s => s === 0)) return;

                // 4人のレコードを作成
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

            // 4. Set Summary (半荘/セットの合計) 保存
            // これは `game_results` とは別のテーブル `set_summaries` に入れる想定（MLB版ロジック）
            // 親となる `games` テーブルがあるならそちらだが、以前のコードでは `game_results` と `set_summaries` だった。
            
            // まずダミーの game_id を作るか、あるいはタイムスタンプで紐づける。
            // ここでは簡易的に「その日のセット」として保存。
            // ※MLB版 app.js に従い、game_id は生成して紐づける必要があるが、
            // コードスニペットでは game.id を参照していた。
            // 今回はシンプルに `set_summaries` に直接突っ込む。
            
            // 合計値取得
            const grandTotals = ['a','b','c','d'].map(id => parseFloat(document.getElementById(`tot-${id}`).innerText));
            const coinTotals = ['a','b','c','d'].map(id => parseFloat(document.getElementById(`coin-${id}`).innerText));
            const tips = ['a','b','c','d'].map(id => parseFloat(document.querySelector(`.tip-in[data-col="${id}"]`).value) || 0);

            // 順位計算
            const summaryData = names.map((name, i) => ({
                name, 
                score: grandTotals[i],
                coins: coinTotals[i],
                tips: tips[i]
            }));
            // スコアでソートして順位付与
            const sorted = [...summaryData].sort((a,b) => b.score - a.score);
            
            const summariesToInsert = names.map((name, i) => {
                const pid = mstr.find(m => m.name === name).id;
                const rank = sorted.findIndex(s => s.name === name) + 1;
                return {
                    player_id: pid,
                    player_name: name, // バックアップ用
                    total_score: grandTotals[i],
                    coins: coinTotals[i],
                    tips: tips[i],
                    final_rank: rank,
                    created_at: finalTimestamp,
                    game_date: gameDate // 検索用
                };
            });

            // DB Insert
            if(resultsToInsert.length > 0) {
                await window.sb.from('game_results').insert(resultsToInsert);
            }
            await window.sb.from('set_summaries').insert(summariesToInsert);

            // 完了演出
            badge.innerText = "MISSION COMPLETE";
            btn.style.background = "var(--p5-black)";
            btn.style.color = "var(--p5-yellow)";
            btn.querySelector('span').innerText = "TAKE YOUR TREASURE";
            
            setTimeout(() => {
                // 履歴画面へ遷移
                location.href = "history.html";
            }, 1000);

        } catch (e) {
            alert("Error: " + e.message);
            console.error(e);
            btn.disabled = false;
            btn.querySelector('span').innerText = "RETRY";
        }
    };

    // --------------------------------------------------------
    // Event Listeners Initialization
    // --------------------------------------------------------
    document.getElementById('add-row').onclick = window.addMatchRow;
    
    // チップ入力欄にもイベント付与
    document.querySelectorAll('.tip-in').forEach(input => {
        input.addEventListener('input', updateTotals);
        input.addEventListener('focus', function() { this.select(); });
    });

    // 初期化実行
    await initRoster();
    // デフォルトで3行くらい追加しておく
    for(let i=0; i<4; i++) window.addMatchRow();


    // --------------------------------------------------------
    // Admin / Easter Egg Logic
    // --------------------------------------------------------
    let entryTapCount = 0;
    let entryTapTimer;
    const entryTrigger = document.getElementById('admin-trigger');

    if (entryTrigger) {
        entryTrigger.addEventListener('click', () => {
            entryTapCount++;
            clearTimeout(entryTapTimer);
            entryTapTimer = setTimeout(() => { entryTapCount = 0; }, 2000);

            if (entryTapCount === 5) {
                entryTapCount = 0;
                const pass = prompt("PHANTOM THIEF PASSWORD:");
                if (pass === "Gemini") {
                    location.href = "admin.html";
                }
            }
        });
    }
});
