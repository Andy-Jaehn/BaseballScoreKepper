const positions=['自由人','投手','捕手','一垒手','二垒手','三垒手','游击手','左外野','中外野','右外野'];
export const throwingPathLabel=value=>[...String(value||'')].map(d=>positions[d]||'无效编号').join('➡');
