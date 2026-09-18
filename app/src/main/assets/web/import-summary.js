export function importSummary(result, esc) {
  const labels={name:'姓名',number:'背号',bats:'打击手',throws:'投球手'};
  const value=(field,v)=>esc(v ? field==='bats'?({R:'右打',L:'左打',S:'左右开弓'}[v]||v):field==='throws'?({R:'右投',L:'左投'}[v]||v):v : '未填写');
  const status={added:'新增球员',restored:'恢复并合并',merged:'同名合并'};
  return '<h2>导入完成</h2><p>新增 '+result.count+' 场，跳过重复 '+result.skipped+' 场。</p><p class="muted">球员按姓名匹配，不区分大小写。同名合并时保留本地背号与惯用手。</p>'+
    '<details open><summary>球员明细 · '+result.playerDetails.length+' 人</summary>'+result.playerDetails.map(p=>'<section class="card"><b>'+esc(p.localName)+'</b> · '+status[p.status]+(p.differences.length?'<p class="muted">'+(p.status==='added'?'资料整理（文件 → 保存）':'资料差异（文件 → 保留的本地资料）')+'</p><ul>'+p.differences.map(d=>'<li>'+labels[d.field]+'：'+value(d.field,d.incoming)+' → '+value(d.field,d.local)+'</li>').join('')+'</ul>':'<p class="muted">'+(p.status==='added'?'已加入球员库':'资料一致')+'</p>')+'</section>').join('')+(!result.playerDetails.length?'<p class="muted">没有新增或合并的球员；重复比赛不再处理球员资料。</p>':'')+'</details>'+
    '<details><summary>比赛明细 · '+result.gameDetails.length+' 场</summary>'+result.gameDetails.map(g=>'<p><b>'+esc(g.teams)+'</b><br><small>'+esc(new Date(g.startedAt).toLocaleString('zh-CN'))+' · '+(g.status==='added'?'已导入':'重复，已跳过')+'</small></p>').join('')+'</details>';
}
